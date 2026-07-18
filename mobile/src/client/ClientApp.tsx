import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { colors } from "../theme";
import type { ActiveOperation } from "../types";
import { HomeScreen } from "../screens/HomeScreen";
import { OperationScreen } from "../screens/OperationScreen";
import { ClientAlbumScreen } from "./screens/ClientAlbumScreen";
import { ClientContractsScreen } from "./screens/ClientContractsScreen";
import { ClientHomeScreen } from "./screens/ClientHomeScreen";
import { ClientPassportScreen } from "./screens/ClientPassportScreen";
import { ClientProductCheckoutScreen } from "./screens/ClientProductCheckoutScreen";
import { ClientProfileEditScreen } from "./screens/ClientProfileEditScreen";
import { ClientProfileScreen } from "./screens/ClientProfileScreen";
import { ClientRankingScreen } from "./screens/ClientRankingScreen";
import { ClientRechargeScreen } from "./screens/ClientRechargeScreen";
import { ClientStoreScreen } from "./screens/ClientStoreScreen";
import { ClientTrailCheckoutScreen } from "./screens/ClientTrailCheckoutScreen";
import { ClientTrailDetailScreen } from "./screens/ClientTrailDetailScreen";
import { ClientTrailsScreen } from "./screens/ClientTrailsScreen";
import { ClientWalletScreen } from "./screens/ClientWalletScreen";
import { ClientBenefitsScreen } from "./screens/ClientBenefitsScreen";
import { ClientSettingsScreen } from "./screens/ClientSettingsScreen";
import type { ClientRoute, MainTab } from "./types";

const tabs: Array<{ name: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { name: "home", label: "Início", icon: "home" },
  { name: "trails", label: "Trilhas", icon: "map" },
  { name: "store", label: "Loja", icon: "bag-handle" },
  { name: "ranking", label: "Ranking", icon: "trophy" },
  { name: "profile", label: "Perfil", icon: "person" },
];

export function ClientApp({
  session,
  active,
  onActive,
  onLogout,
}: {
  session: Session;
  active: ActiveOperation | null;
  onActive: (operation: ActiveOperation | null) => void;
  onLogout: () => void;
}) {
  const [history, setHistory] = useState<ClientRoute[]>([{ name: "home" }]);
  const route = history[history.length - 1];
  const mainTab = isMainTab(route.name) ? route.name : null;
  const navigate = (next: ClientRoute) => {
    if (isMainTab(next.name)) setHistory([{ name: next.name }]);
    else setHistory((current) => [...current, next]);
  };
  const back = () => setHistory((current) => current.length > 1 ? current.slice(0, -1) : [{ name: "home" }]);

  let screen: React.ReactNode;
  switch (route.name) {
    case "home": screen = <ClientHomeScreen session={session} navigate={navigate} />; break;
    case "trails": screen = <ClientTrailsScreen session={session} navigate={navigate} />; break;
    case "store": screen = <ClientStoreScreen navigate={navigate} />; break;
    case "ranking": screen = <ClientRankingScreen session={session} />; break;
    case "profile": screen = <ClientProfileScreen session={session} navigate={navigate} onLogout={onLogout} />; break;
    case "trail-detail": screen = <ClientTrailDetailScreen session={session} trail={route.trail} owned={route.owned} navigate={navigate} onBack={back} />; break;
    case "trail-checkout": screen = <ClientTrailCheckoutScreen session={session} trail={route.trail} onBack={back} onComplete={() => setHistory([{ name: "trails" }])} />; break;
    case "product-checkout": screen = <ClientProductCheckoutScreen session={session} product={route.product} onBack={back} onComplete={() => setHistory([{ name: "store" }])} />; break;
    case "wallet": screen = <ClientWalletScreen session={session} onBack={back} />; break;
    case "recharge": screen = <ClientRechargeScreen session={session} onBack={back} />; break;
    case "passport": screen = <ClientPassportScreen session={session} onBack={back} />; break;
    case "contracts": screen = <ClientContractsScreen session={session} onBack={back} />; break;
    case "album": screen = <ClientAlbumScreen session={session} agendaId={route.agendaId} title={route.title} onBack={back} />; break;
    case "profile-edit": screen = <ClientProfileEditScreen session={session} onBack={back} />; break;
    case "benefits": screen = <ClientBenefitsScreen onBack={back} />; break;
    case "settings": screen = <ClientSettingsScreen onBack={back} />; break;
    case "safety":
      screen = (
        <View style={styles.safetyPage}>
          <View style={styles.safetyHeader}>
            <TouchableOpacity style={styles.safetyBack} onPress={back}>
              <Ionicons name="chevron-back" size={23} color={colors.white} />
              <Text style={styles.safetyBackText}>Voltar ao aplicativo</Text>
            </TouchableOpacity>
            <View style={styles.protectionPill}>
              <View style={styles.protectionDot} />
              <Text style={styles.protectionText}>{active ? "Proteção ativa" : "Segurança"}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {active ? (
              <OperationScreen session={session} initial={active} onExit={() => onActive(null)} />
            ) : (
              <HomeScreen session={session} onActive={onActive} onLogout={onLogout} />
            )}
          </View>
        </View>
      );
      break;
  }

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>{screen}</View>
      {mainTab ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abrir segurança e rastreamento"
            style={[styles.safetyButton, active && styles.safetyActive]}
            onPress={() => navigate({ name: "safety" })}
          >
            <Ionicons name={active ? "radio" : "shield-checkmark"} size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.nav}>
            {tabs.map((tab) => {
              const selected = tab.name === mainTab;
              const icon = selected ? tab.icon : `${tab.icon}-outline` as keyof typeof Ionicons.glyphMap;
              return (
                <TouchableOpacity key={tab.name} style={styles.navItem} onPress={() => navigate({ name: tab.name })}>
                  <Ionicons name={icon} size={21} color={selected ? colors.orange : "#7C8C99"} />
                  <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function isMainTab(name: ClientRoute["name"]): name is MainTab {
  return ["home", "trails", "store", "ranking", "profile"].includes(name);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  nav: { position: "absolute", left: 10, right: 10, bottom: 8, minHeight: 72, borderRadius: 25, backgroundColor: colors.white, borderWidth: 1, borderColor: "#DDE5EA", flexDirection: "row", paddingHorizontal: 5, paddingTop: 10, paddingBottom: 7, shadowColor: colors.navy950, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navLabel: { color: "#7C8C99", fontSize: 8, fontWeight: "800" },
  navLabelActive: { color: colors.orange },
  safetyButton: { position: "absolute", right: 18, bottom: 91, width: 54, height: 54, borderRadius: 21, backgroundColor: colors.navy900, alignItems: "center", justifyContent: "center", shadowColor: colors.navy950, shadowOpacity: 0.24, shadowRadius: 10, elevation: 7 },
  safetyActive: { backgroundColor: colors.success },
  safetyPage: { flex: 1, backgroundColor: colors.background },
  safetyHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: colors.navy950, paddingHorizontal: 12 },
  safetyBack: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  safetyBackText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  protectionPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  protectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  protectionText: { color: colors.white, fontSize: 9, fontWeight: "900" },
});
