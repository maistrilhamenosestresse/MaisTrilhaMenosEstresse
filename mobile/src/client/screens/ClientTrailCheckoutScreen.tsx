import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { checkoutTrail, createReservation, getCurrentClient } from "../../api";
import { supabase } from "../../auth";
import { colors } from "../../theme";
import {
  ClientHeader,
  ClientScreen,
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  formatCurrency,
  formatDate,
} from "../ClientUi";
import type { ClientRecord, TrailRecord } from "../types";

type PaymentMethod = "INFINITEPAY" | "BOLETO";

export function ClientTrailCheckoutScreen({
  session,
  trail,
  onBack,
  onComplete,
}: {
  session: Session;
  trail: TrailRecord;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [reservationId, setReservationId] = useState("");
  const [useCashback, setUseCashback] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("INFINITEPAY");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const accepted = trail.accepted_payment_methods?.length
    ? trail.accepted_payment_methods
    : ["PIX", "CREDIT_CARD"];
  const acceptsInfinitePay = accepted.some((item) => item === "PIX" || item === "CREDIT_CARD");
  const acceptsBoleto = accepted.includes("BOLETO");

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getCurrentClient(session);
        setClient(profile.client as ClientRecord);
        const existing = await supabase
          .from("reservas")
          .select("id, purchase_channel")
          .eq("client_id", profile.client.id)
          .eq("agenda_id", trail.id)
          .eq("status_pagamento", "pendente")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data?.id && existing.data.purchase_channel === "app") {
          setReservationId(existing.data.id);
        } else {
          const created = await createReservation(session, {
            client_id: profile.client.id,
            agenda_id: trail.id,
            checkout_source: "app",
          });
          setReservationId(String(created.reservas?.[0]?.id || ""));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível preparar sua reserva.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, trail.id]);

  useEffect(() => {
    if (method === "INFINITEPAY" && acceptsInfinitePay) return;
    if (method === "BOLETO" && acceptsBoleto) return;
    setMethod(acceptsInfinitePay ? "INFINITEPAY" : "BOLETO");
  }, [acceptsBoleto, acceptsInfinitePay, method]);

  const benefit = useMemo(() => {
    let remaining = Number(trail.price || 0);
    const cashback = useCashback ? Math.min(Number(client?.cashback_saldo || 0), remaining) : 0;
    remaining -= cashback;
    const points = usePoints ? Math.min(Number(client?.pontos || 0), Math.floor(remaining * 100)) : 0;
    remaining -= points / 100;
    return { cashback, points, due: Math.max(0, remaining) };
  }, [client, trail.price, useCashback, usePoints]);

  const pay = async () => {
    if (!reservationId) return;
    setBusy(true);
    setError("");
    try {
      const result = await checkoutTrail(session, {
        reserva_ids: [reservationId],
        payment_method: method,
        installments: 1,
        checkout_source: "app",
        use_cashback: useCashback,
        use_points: usePoints,
        customer_data: {
          postalCode: String((client as any)?.postal_code || ""),
          addressNumber: String((client as any)?.address_number || ""),
        },
      });
      if (result.type === "INTERNAL" || result.status === "CONFIRMED") {
        setSuccess(true);
        return;
      }
      const checkoutUrl = String(result.redirectUrl || result.invoiceUrl || result.bankSlipUrl || "");
      if (!checkoutUrl) throw new Error("O provedor não retornou o link do pagamento.");
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: colors.orange,
      });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao iniciar o pagamento.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Preparando seu carrinho…" />;

  if (success) {
    return (
      <View style={styles.successPage}>
        <View style={styles.successIcon}><Ionicons name="checkmark" size={50} color={colors.white} /></View>
        <Text style={styles.successTitle}>Vaga garantida!</Text>
        <Text style={styles.successText}>Seu pagamento com saldo e pontos foi confirmado.</Text>
        <PrimaryButton label="Abrir minhas trilhas" icon="map" onPress={onComplete} tone="navy" />
      </View>
    );
  }

  const image = trail.flyer_url || trail.images?.[0];
  return (
    <View style={styles.page}>
      <ClientHeader title="Carrinho da trilha" subtitle="COMPRA SEGURA" onBack={onBack} />
      <ClientScreen>
        <View style={styles.product}>
          <View style={styles.imageWrap}>
            {image ? <Image source={{ uri: image }} style={styles.image} /> : <Ionicons name="image-outline" size={32} color={colors.muted} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle}>{trail.title}</Text>
            <Text style={styles.meta}>{formatDate(trail.date)}</Text>
            <Text style={styles.productPrice}>{formatCurrency(trail.price)}</Text>
          </View>
        </View>

        <Text style={styles.section}>SEUS BENEFÍCIOS DO APP</Text>
        <BenefitToggle
          icon="wallet"
          title="Usar saldo"
          subtitle={`Disponível: ${formatCurrency(client?.cashback_saldo)}`}
          value={useCashback}
          disabled={Number(client?.cashback_saldo || 0) <= 0}
          onChange={setUseCashback}
        />
        <BenefitToggle
          icon="star"
          title="Usar pontos"
          subtitle={`${Number(client?.pontos || 0).toLocaleString("pt-BR")} pontos = ${formatCurrency(Number(client?.pontos || 0) / 100)}`}
          value={usePoints}
          disabled={Number(client?.pontos || 0) <= 0}
          onChange={setUsePoints}
        />

        <View style={styles.total}>
          {benefit.cashback > 0 ? <PriceRow label="Saldo utilizado" value={`- ${formatCurrency(benefit.cashback)}`} /> : null}
          {benefit.points > 0 ? <PriceRow label={`${benefit.points} pontos`} value={`- ${formatCurrency(benefit.points / 100)}`} /> : null}
          <View style={styles.divider} />
          <PriceRow label="Você paga agora" value={formatCurrency(benefit.due)} strong />
        </View>

        {benefit.due > 0 ? (
          <>
            <Text style={styles.section}>FORMA DE PAGAMENTO</Text>
            {acceptsInfinitePay ? (
              <PaymentOption
                selected={method === "INFINITEPAY"}
                icon="card"
                title="Pix ou cartão"
                subtitle="Pagamento seguro pela InfinitePay"
                onPress={() => setMethod("INFINITEPAY")}
              />
            ) : null}
            {acceptsBoleto ? (
              <PaymentOption
                selected={method === "BOLETO"}
                icon="document-text"
                title="Boleto"
                subtitle="Boleto processado exclusivamente pela Asaas"
                onPress={() => setMethod("BOLETO")}
              />
            ) : null}
          </>
        ) : null}

        <ErrorBanner message={error} />
        <PrimaryButton
          label={benefit.due <= 0 ? "Confirmar com benefícios" : method === "BOLETO" ? "Gerar boleto Asaas" : "Continuar na InfinitePay"}
          icon="shield-checkmark"
          onPress={pay}
          loading={busy}
          disabled={!reservationId || (benefit.due > 0 && !acceptsInfinitePay && !acceptsBoleto)}
          tone="navy"
        />
        <Text style={styles.notice}>A pontuação é gerada somente após a confirmação de compras iniciadas pelo aplicativo.</Text>
      </ClientScreen>
    </View>
  );
}

function BenefitToggle({ icon, title, subtitle, value, disabled, onChange }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.option, disabled && styles.disabled]}>
      <View style={styles.optionIcon}><Ionicons name={icon} size={22} color={colors.orange} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.success }} />
    </View>
  );
}

function PaymentOption({ selected, icon, title, subtitle, onPress }: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.option, selected && styles.optionSelected]} onPress={onPress}>
      <View style={styles.optionIcon}><Ionicons name={icon} size={22} color={colors.navy900} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={23} color={selected ? colors.orange : colors.muted} />
    </TouchableOpacity>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.priceValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  product: { borderRadius: 23, backgroundColor: colors.white, padding: 13, flexDirection: "row", gap: 13, alignItems: "center" },
  imageWrap: { width: 88, height: 88, borderRadius: 19, overflow: "hidden", backgroundColor: "#E8EDF1", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  productTitle: { color: colors.navy950, fontSize: 15, lineHeight: 19, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  productPrice: { color: colors.orange, fontSize: 17, fontWeight: "900", marginTop: 5 },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  option: { minHeight: 72, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: "transparent", padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  optionSelected: { borderColor: colors.navy900, backgroundColor: "#EAF0F5" },
  disabled: { opacity: 0.5 },
  optionIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center" },
  optionTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  optionSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  total: { borderRadius: 22, backgroundColor: colors.navy950, padding: 17, gap: 9 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  priceLabel: { color: "#B6C7D5", fontSize: 12 },
  priceValue: { color: "#D8E4EC", fontSize: 12, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  strong: { color: colors.white, fontSize: 16, fontWeight: "900" },
  notice: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  successPage: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 30, gap: 15 },
  successIcon: { width: 100, height: 100, borderRadius: 40, alignSelf: "center", backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  successTitle: { color: colors.navy950, fontSize: 27, fontWeight: "900", textAlign: "center" },
  successText: { color: colors.muted, lineHeight: 20, textAlign: "center", marginBottom: 12 },
});
