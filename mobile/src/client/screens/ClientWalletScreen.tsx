import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getCurrentClient } from "../../api";
import { supabase } from "../../auth";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen, EmptyState, ErrorBanner, LoadingState, formatCurrency, formatDate } from "../ClientUi";

type Transaction = {
  id: string;
  title: string;
  date: string;
  value: number;
  positive: boolean;
  detail: string;
};

export function ClientWalletScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [balance, setBalance] = useState(0);
  const [points, setPoints] = useState(0);
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getCurrentClient(session);
        const client = profile.client;
        setBalance(Number(client.cashback_saldo || 0));
        setPoints(Number(client.pontos || 0));
        const [wallet, pointsTx, reservations, orders] = await Promise.all([
          supabase.from("wallet_transactions").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("points_transactions").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("reservas").select("id, created_at, valor_pago, agendas(title, price)").eq("client_id", client.id).eq("status_pagamento", "pago").order("created_at", { ascending: false }),
          supabase.from("pedidos_loja").select("id, created_at, valor_total, produtos(name, price)").eq("client_id", client.id).eq("status_pagamento", "pago").order("created_at", { ascending: false }),
        ]);
        const merged: Transaction[] = [];
        for (const row of wallet.data || []) {
          merged.push({
            id: `w:${row.id}`,
            title: row.description,
            date: row.created_at,
            value: Number(row.amount || 0),
            positive: row.type === "credit" || row.type === "refund",
            detail: "Saldo",
          });
        }
        for (const row of pointsTx.data || []) {
          merged.push({
            id: `p:${row.id}`,
            title: row.description,
            date: row.created_at,
            value: Number(row.points || 0),
            positive: Number(row.points || 0) >= 0,
            detail: "Pontos",
          });
        }
        for (const row of reservations.data || []) {
          const agenda = row.agendas as any;
          merged.push({
            id: `r:${row.id}`,
            title: `Trilha: ${agenda?.title || "Aventura"}`,
            date: row.created_at,
            value: Number(row.valor_pago || agenda?.price || 0),
            positive: false,
            detail: "Compra",
          });
        }
        for (const row of orders.data || []) {
          const product = row.produtos as any;
          merged.push({
            id: `o:${row.id}`,
            title: `Loja: ${product?.name || "Produto"}`,
            date: row.created_at,
            value: Number(row.valor_total || product?.price || 0),
            positive: false,
            detail: "Compra",
          });
        }
        merged.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        setItems(merged);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar seu extrato.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  if (loading) return <LoadingState label="Organizando sua movimentação…" />;

  return (
    <View style={styles.page}>
      <ClientHeader title="Carteira e extrato" subtitle="FINANCEIRO" onBack={onBack} />
      <ClientScreen>
        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>SALDO DISPONÍVEL</Text>
            <Text style={styles.balance}>{formatCurrency(balance)}</Text>
          </View>
          <View style={styles.pointsPill}><Text style={styles.points}>{points.toLocaleString("pt-BR")} ★</Text></View>
        </View>
        <ErrorBanner message={error} />
        <Text style={styles.section}>HISTÓRICO COMPLETO</Text>
        {items.length ? items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={[styles.icon, item.positive ? styles.positiveIcon : styles.negativeIcon]}>
              <Ionicons name={item.positive ? "arrow-down" : "arrow-up"} size={19} color={item.positive ? colors.success : colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.meta}>{item.detail} · {formatDate(item.date)}</Text>
            </View>
            <Text style={[styles.value, item.positive && styles.positive]}>
              {item.positive ? "+" : "-"} {item.detail === "Pontos" ? `${Math.abs(item.value)} pts` : formatCurrency(Math.abs(item.value))}
            </Text>
          </View>
        )) : <EmptyState icon="receipt-outline" title="Nenhuma movimentação" text="Suas compras, recargas e pontos aparecerão aqui." />}
      </ClientScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  summary: { borderRadius: 27, backgroundColor: colors.navy950, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "#9CB6C8", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  balance: { color: colors.white, fontSize: 30, fontWeight: "900", marginTop: 4 },
  pointsPill: { borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 13, paddingVertical: 10 },
  points: { color: "#FFD36C", fontWeight: "900" },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.3, marginHorizontal: 3 },
  row: { borderRadius: 20, backgroundColor: colors.white, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  positiveIcon: { backgroundColor: "#E1F4EA" },
  negativeIcon: { backgroundColor: "#FFF0E6" },
  title: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  value: { color: colors.text, fontSize: 11, fontWeight: "900", textAlign: "right", maxWidth: 100 },
  positive: { color: colors.success },
});
