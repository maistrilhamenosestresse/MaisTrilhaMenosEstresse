import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getCurrentClient } from "../../api";
import { colors } from "../../theme";
import { ClientScreen, LoadingState, formatCurrency } from "../ClientUi";
import type { ClientRecord, ClientRoute } from "../types";

export function ClientProfileScreen({
  session,
  navigate,
  onLogout,
}: {
  session: Session;
  navigate: (route: ClientRoute) => void;
  onLogout: () => void;
}) {
  const [client, setClient] = useState<ClientRecord | null>(null);

  useEffect(() => {
    void getCurrentClient(session).then((result) => setClient(result.client as ClientRecord));
  }, [session]);

  const initials = useMemo(() => {
    const parts = String(client?.full_name || "Aventureiro").trim().split(/\s+/);
    return `${parts[0]?.[0] || "A"}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  }, [client?.full_name]);

  if (!client) return <LoadingState label="Carregando seu perfil…" />;

  return (
    <ClientScreen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          {client.photo_url ? (
            <Image source={{ uri: client.photo_url }} style={styles.avatarImage} />
          ) : <Text style={styles.initials}>{initials}</Text>}
        </View>
        <Text style={styles.name}>{client.full_name}</Text>
        <Text style={styles.email}>{client.email}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>SALDO</Text>
            <Text style={styles.balanceValue}>{formatCurrency(client.cashback_saldo)}</Text>
          </View>
          <View style={[styles.balanceBox, styles.pointsBox]}>
            <Text style={[styles.balanceLabel, { color: "#9A6A00" }]}>PONTOS</Text>
            <Text style={[styles.balanceValue, { color: "#7A5500" }]}>{Number(client.pontos || 0).toLocaleString("pt-BR")}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.section}>MINHA CONTA</Text>
      <View style={styles.menu}>
        <MenuItem icon="person" label="Dados pessoais e foto" onPress={() => navigate({ name: "profile-edit" })} />
        <MenuItem icon="receipt" label="Carteira e extratos" onPress={() => navigate({ name: "wallet" })} />
        <MenuItem icon="map" label="Passaporte de trilhas" onPress={() => navigate({ name: "passport" })} />
        <MenuItem icon="gift" label="Benefícios do aplicativo" onPress={() => navigate({ name: "benefits" })} />
      </View>

      <Text style={styles.section}>SEGURANÇA E DOCUMENTOS</Text>
      <View style={styles.menu}>
        <MenuItem icon="document-text" label="Termos, contratos e seguro" onPress={() => navigate({ name: "contracts" })} />
        <MenuItem icon="shield-checkmark" label="Privacidade e permissões" onPress={() => navigate({ name: "settings" })} />
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={21} color={colors.danger} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ClientScreen>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIcon}><Ionicons name={icon} size={21} color={colors.navy900} /></View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={19} color="#AAB7C2" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, paddingBottom: 115, gap: 13 },
  hero: { backgroundColor: colors.white, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, alignItems: "center", paddingHorizontal: 20, paddingTop: 26, paddingBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 36, backgroundColor: colors.navy900, borderWidth: 4, borderColor: colors.white, shadowColor: colors.navy950, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  initials: { color: colors.white, fontSize: 29, fontWeight: "900" },
  name: { color: colors.navy950, fontSize: 23, fontWeight: "900", marginTop: 14 },
  email: { color: colors.muted, fontSize: 12, marginTop: 4 },
  balanceRow: { width: "100%", flexDirection: "row", gap: 9, marginTop: 18 },
  balanceBox: { flex: 1, borderRadius: 17, backgroundColor: "#E3F4EA", padding: 12, alignItems: "center" },
  pointsBox: { backgroundColor: "#FFF3CB" },
  balanceLabel: { color: colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  balanceValue: { color: "#126848", fontSize: 14, fontWeight: "900", marginTop: 3 },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginHorizontal: 18, marginTop: 8 },
  menu: { marginHorizontal: 16, borderRadius: 24, backgroundColor: colors.white, padding: 7 },
  menuItem: { minHeight: 62, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10 },
  menuIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#E7EEF6", alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "900" },
  logout: { minHeight: 54, marginHorizontal: 16, borderRadius: 18, backgroundColor: "#FFF0F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: colors.danger, fontWeight: "900" },
});
