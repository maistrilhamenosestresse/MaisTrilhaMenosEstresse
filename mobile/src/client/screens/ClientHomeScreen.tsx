import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getCurrentClient } from "../../api";
import { supabase } from "../../auth";
import { colors } from "../../theme";
import { Card, ClientScreen, ErrorBanner, LoadingState, formatCurrency } from "../ClientUi";
import type { ClientRecord, ClientRoute, ProductRecord } from "../types";

export function ClientHomeScreen({
  session,
  navigate,
}: {
  session: Session;
  navigate: (route: ClientRoute) => void;
}) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [profile, productResult] = await Promise.all([
          getCurrentClient(session),
          supabase
            .from("produtos")
            .select("id, name, category, price, stock, image, active")
            .eq("active", true)
            .gt("stock", 0)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        setClient(profile.client as ClientRecord);
        setProducts((productResult.data || []) as ProductRecord[]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar sua conta.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const initials = useMemo(() => {
    const parts = String(client?.full_name || "Aventureiro").trim().split(/\s+/);
    return `${parts[0]?.[0] || "A"}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  }, [client?.full_name]);

  const level = Number(client?.pontos || 0) > 500
    ? "Lenda da Trilha"
    : Number(client?.pontos || 0) > 100
      ? "Explorador"
      : "Iniciante";

  if (loading) return <LoadingState label="Preparando sua Área do Aventureiro…" />;

  return (
    <ClientScreen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {client?.photo_url ? (
                <Image source={{ uri: client.photo_url }} style={styles.avatarImage} />
              ) : <Text style={styles.avatarText}>{initials}</Text>}
            </View>
            <View>
              <Text style={styles.heroSmall}>Olá, {level}</Text>
              <Text style={styles.heroName}>{client?.full_name || "Aventureiro"}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.starButton} onPress={() => navigate({ name: "ranking" })}>
            <Ionicons name="star" size={21} color="#F7C948" />
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceLabel}>Saldo disponível</Text>
        <Text style={styles.balance}>{formatCurrency(client?.cashback_saldo)}</Text>
        <Text style={styles.points}>
          {Number(client?.pontos || 0).toLocaleString("pt-BR")} pontos · {formatCurrency(Number(client?.pontos || 0) / 100)} em benefícios
        </Text>
      </View>

      <ErrorBanner message={error} />

      <View style={styles.quickGrid}>
        <QuickAction icon="bag-handle" label="Loja" onPress={() => navigate({ name: "store" })} />
        <QuickAction icon="wallet" label="Recarregar" onPress={() => navigate({ name: "recharge" })} />
        <QuickAction icon="ribbon" label="Passaporte" onPress={() => navigate({ name: "passport" })} />
        <QuickAction icon="receipt" label="Extrato" onPress={() => navigate({ name: "wallet" })} />
      </View>

      <TouchableOpacity style={styles.passport} onPress={() => navigate({ name: "passport" })}>
        <View style={styles.passportIcon}><Ionicons name="map" size={27} color="#FFD4B8" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.passportEyebrow}>SUA JORNADA</Text>
          <Text style={styles.passportTitle}>Passaporte de Trilhas</Text>
          <Text style={styles.passportText}>Colecione selos e acompanhe suas conquistas.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#BFD0DD" />
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>EQUIPAMENTOS</Text>
          <Text style={styles.sectionTitle}>Loja Mais Trilha</Text>
        </View>
        <TouchableOpacity onPress={() => navigate({ name: "store" })}>
          <Text style={styles.seeAll}>Ver tudo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.productGrid}>
        {products.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.product}
            onPress={() => navigate({ name: "product-checkout", product })}
          >
            <View style={styles.productImageWrap}>
              {product.image ? (
                <Image source={{ uri: product.image }} style={styles.productImage} />
              ) : <Ionicons name="cube-outline" size={34} color="#AAB7C2" />}
            </View>
            <Text style={styles.productCategory} numberOfLines={1}>{product.category}</Text>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card>
        <View style={styles.walletCard}>
          <View style={styles.walletIcon}><Ionicons name="receipt-outline" size={27} color={colors.navy900} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletTitle}>Sua movimentação</Text>
            <Text style={styles.walletText}>Compras, recargas, saldo e pontos em um extrato completo.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.walletLink} onPress={() => navigate({ name: "wallet" })}>
          <Text style={styles.walletLinkText}>Abrir meu extrato</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </Card>
    </ClientScreen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}><Ionicons name={icon} size={23} color={colors.orange} /></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, paddingBottom: 120, gap: 18 },
  hero: { backgroundColor: colors.navy950, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 70 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 34 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: "900" },
  heroSmall: { color: "#9DB7CA", fontSize: 11, fontWeight: "700" },
  heroName: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 2 },
  starButton: { width: 42, height: 42, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  balanceLabel: { color: "#AFC5D5", fontSize: 12, fontWeight: "700" },
  balance: { color: colors.white, fontSize: 36, fontWeight: "900", marginTop: 4 },
  points: { color: "#BFD0DD", fontSize: 11, lineHeight: 17, marginTop: 5 },
  quickGrid: { marginHorizontal: 16, marginTop: -55, backgroundColor: colors.white, borderRadius: 28, flexDirection: "row", padding: 12, shadowColor: colors.navy950, shadowOpacity: 0.12, shadowRadius: 18, elevation: 6 },
  quickAction: { flex: 1, alignItems: "center", gap: 7 },
  quickIcon: { width: 46, height: 46, borderRadius: 17, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center" },
  quickLabel: { color: colors.text, fontSize: 10, fontWeight: "900" },
  passport: { marginHorizontal: 16, borderRadius: 26, backgroundColor: colors.navy900, padding: 17, flexDirection: "row", alignItems: "center", gap: 13 },
  passportIcon: { width: 54, height: 54, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  passportEyebrow: { color: "#F7B98E", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  passportTitle: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 3 },
  passportText: { color: "#AFC5D5", fontSize: 10, marginTop: 3 },
  sectionHeader: { marginHorizontal: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionEyebrow: { color: colors.orange, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  sectionTitle: { color: colors.navy950, fontSize: 20, fontWeight: "900", marginTop: 3 },
  seeAll: { color: colors.orange, fontSize: 12, fontWeight: "900" },
  productGrid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  product: { width: "48%", minHeight: 210, borderRadius: 22, backgroundColor: colors.white, padding: 12 },
  productImageWrap: { height: 105, borderRadius: 16, backgroundColor: "#EDF1F4", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  productImage: { width: "100%", height: "100%" },
  productCategory: { color: colors.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase", marginTop: 10 },
  productName: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 3, minHeight: 32 },
  productPrice: { color: colors.orange, fontSize: 14, fontWeight: "900", marginTop: 5 },
  walletCard: { flexDirection: "row", alignItems: "center", gap: 13 },
  walletIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#E7EEF6", alignItems: "center", justifyContent: "center" },
  walletTitle: { color: colors.navy950, fontSize: 17, fontWeight: "900" },
  walletText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  walletLink: { marginTop: 15, minHeight: 48, borderRadius: 16, backgroundColor: colors.navy900, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  walletLinkText: { color: colors.white, fontWeight: "900" },
});
