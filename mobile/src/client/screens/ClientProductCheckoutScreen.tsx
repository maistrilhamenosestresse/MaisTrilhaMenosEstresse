import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { checkoutStore, getCurrentClient } from "../../api";
import { colors } from "../../theme";
import {
  ClientHeader,
  ClientScreen,
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  formatCurrency,
} from "../ClientUi";
import type { ClientRecord, ProductRecord } from "../types";

type Delivery = "retirada" | "correios" | "entrega_trilha";
type Payment = "infinitepay" | "boleto" | "cashback";

export function ClientProductCheckoutScreen({
  session,
  product,
  onBack,
  onComplete,
}: {
  session: Session;
  product: ProductRecord;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [delivery, setDelivery] = useState<Delivery>("retirada");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [payment, setPayment] = useState<Payment>("infinitepay");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getCurrentClient(session)
      .then((result) => setClient(result.client as ClientRecord))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao carregar sua conta."));
  }, [session]);

  const submit = async () => {
    if (!client) return;
    setBusy(true);
    setError("");
    try {
      const result = await checkoutStore(session, {
        produtoId: product.id,
        clientId: client.id,
        method: payment,
        forma_entrega: delivery,
        delivery_info: deliveryInfo,
      });
      if (result.provider === "INTERNAL" || result.type === "CASHBACK_FULL") {
        setSuccess(true);
        return;
      }
      const url = String(result.redirectUrl || result.invoiceUrl || result.bankSlipUrl || "");
      if (!url) throw new Error("O provedor não retornou o link do pagamento.");
      await WebBrowser.openBrowserAsync(url, { controlsColor: colors.orange });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível finalizar o pedido.");
    } finally {
      setBusy(false);
    }
  };

  if (!client && !error) return <LoadingState label="Preparando o pedido…" />;
  if (success) {
    return (
      <View style={styles.success}>
        <Ionicons name="checkmark-circle" size={96} color={colors.success} />
        <Text style={styles.successTitle}>Pedido confirmado!</Text>
        <Text style={styles.successText}>Você pode acompanhar a movimentação no seu extrato.</Text>
        <PrimaryButton label="Voltar para a loja" onPress={onComplete} tone="navy" />
      </View>
    );
  }

  const creditAvailable = Number(client?.cashback_saldo || 0) + Number(client?.pontos || 0) / 100;
  return (
    <View style={styles.page}>
      <ClientHeader title="Finalizar pedido" subtitle="LOJA MAIS TRILHA" onBack={onBack} />
      <ClientScreen>
        <View style={styles.product}>
          <View style={styles.imageWrap}>
            {product.image ? <Image source={{ uri: product.image }} style={styles.image} /> : <Ionicons name="cube-outline" size={40} color={colors.muted} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          </View>
        </View>

        <Text style={styles.section}>ENTREGA</Text>
        <View style={styles.row}>
          <Choice label="Retirada" selected={delivery === "retirada"} onPress={() => setDelivery("retirada")} />
          <Choice label="Correios" selected={delivery === "correios"} onPress={() => setDelivery("correios")} />
          <Choice label="Na trilha" selected={delivery === "entrega_trilha"} onPress={() => setDelivery("entrega_trilha")} />
        </View>
        {delivery !== "retirada" ? (
          <TextInput
            value={deliveryInfo}
            onChangeText={setDeliveryInfo}
            placeholder={delivery === "correios" ? "Endereço completo e CEP" : "Informe a trilha escolhida"}
            placeholderTextColor="#8795A1"
            multiline
            style={styles.input}
          />
        ) : null}

        <Text style={styles.section}>PAGAMENTO</Text>
        <PaymentChoice
          icon="card"
          title="Pix ou cartão"
          subtitle="InfinitePay"
          selected={payment === "infinitepay"}
          onPress={() => setPayment("infinitepay")}
        />
        <PaymentChoice
          icon="document-text"
          title="Boleto"
          subtitle="Asaas"
          selected={payment === "boleto"}
          onPress={() => setPayment("boleto")}
        />
        <PaymentChoice
          icon="wallet"
          title="Saldo e pontos"
          subtitle={`Disponível: ${formatCurrency(creditAvailable)}`}
          selected={payment === "cashback"}
          onPress={() => setPayment("cashback")}
        />

        <View style={styles.total}>
          <Text style={styles.totalLabel}>TOTAL DO PRODUTO</Text>
          <Text style={styles.totalValue}>{formatCurrency(product.price)}</Text>
          <Text style={styles.totalHint}>O sistema usa primeiro seu saldo e seus pontos; o restante segue pela forma escolhida.</Text>
        </View>
        <ErrorBanner message={error} />
        <PrimaryButton
          label={payment === "boleto" ? "Gerar boleto Asaas" : payment === "cashback" ? "Pagar com benefícios" : "Continuar na InfinitePay"}
          icon="shield-checkmark"
          onPress={submit}
          loading={busy}
          disabled={!client || (delivery !== "retirada" && deliveryInfo.trim().length < 5)}
          tone="navy"
        />
      </ClientScreen>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PaymentChoice({ icon, title, subtitle, selected, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.payment, selected && styles.paymentSelected]} onPress={onPress}>
      <View style={styles.paymentIcon}><Ionicons name={icon} size={22} color={colors.navy900} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentTitle}>{title}</Text>
        <Text style={styles.paymentSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={23} color={selected ? colors.orange : colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  product: { borderRadius: 23, backgroundColor: colors.white, padding: 13, flexDirection: "row", gap: 13, alignItems: "center" },
  imageWrap: { width: 96, height: 96, borderRadius: 20, backgroundColor: "#E8EDF1", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  category: { color: colors.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  name: { color: colors.navy950, fontSize: 16, lineHeight: 20, fontWeight: "900", marginTop: 4 },
  price: { color: colors.orange, fontSize: 18, fontWeight: "900", marginTop: 5 },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  row: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: "#C9D3DC", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  choiceSelected: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  choiceText: { color: colors.muted, fontSize: 10, fontWeight: "900", textAlign: "center" },
  choiceTextSelected: { color: colors.white },
  input: { minHeight: 88, borderRadius: 18, backgroundColor: colors.white, padding: 14, textAlignVertical: "top", color: colors.text },
  payment: { minHeight: 70, borderRadius: 20, borderWidth: 1, borderColor: "transparent", backgroundColor: colors.white, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  paymentSelected: { borderColor: colors.navy900, backgroundColor: "#EAF0F5" },
  paymentIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#E7EEF6", alignItems: "center", justifyContent: "center" },
  paymentTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  paymentSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  total: { borderRadius: 22, backgroundColor: colors.navy950, padding: 18 },
  totalLabel: { color: "#9CB6C8", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  totalValue: { color: colors.white, fontSize: 29, fontWeight: "900", marginTop: 5 },
  totalHint: { color: "#B6C7D5", fontSize: 10, lineHeight: 15, marginTop: 7 },
  success: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: colors.background, padding: 28 },
  successTitle: { color: colors.navy950, fontSize: 26, fontWeight: "900" },
  successText: { color: colors.muted, lineHeight: 20, textAlign: "center", marginBottom: 10 },
});
