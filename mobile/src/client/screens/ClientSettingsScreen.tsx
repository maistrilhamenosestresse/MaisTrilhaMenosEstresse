import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Application from "expo-application";
import { initializeSafetyNotifications } from "../../notifications";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen, ErrorBanner } from "../ClientUi";

export function ClientSettingsScreen({ onBack }: { onBack: () => void }) {
  const [notifications, setNotifications] = useState(false);
  const [location, setLocation] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [notificationPermission, locationPermission] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
    ]);
    setNotifications(notificationPermission.granted);
    setLocation(locationPermission.granted);
  };
  useEffect(() => { void refresh(); }, []);

  const enableNotifications = async () => {
    try {
      await initializeSafetyNotifications();
      await refresh();
    } catch {
      setError("Não foi possível ativar as notificações. Abra as configurações do aparelho.");
    }
  };

  return (
    <View style={styles.page}>
      <ClientHeader title="Configurações" subtitle="PRIVACIDADE E PERMISSÕES" onBack={onBack} />
      <ClientScreen>
        <Permission
          icon="notifications"
          title="Notificações de segurança"
          text="Mostra SOS, ajuda e avisos da operação na barra do Android."
          enabled={notifications}
          onPress={() => void enableNotifications()}
        />
        <Permission
          icon="navigate"
          title="Localização"
          text="Necessária apenas quando você entra em uma operação de trilha."
          enabled={location}
          onPress={() => void Linking.openSettings()}
        />
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark" size={24} color={colors.success} />
          <Text style={styles.privacyText}>Localização e mensagens do grupo são protegidas, guardadas localmente quando não há internet e enviadas somente à operação vinculada.</Text>
        </View>
        <ErrorBanner message={error} />
        <TouchableOpacity style={styles.settingsButton} onPress={() => void Linking.openSettings()}>
          <Text style={styles.settingsText}>Abrir configurações do Android</Text>
          <Ionicons name="open-outline" size={18} color={colors.navy900} />
        </TouchableOpacity>
        <Text style={styles.version}>
          Mais Trilha {Application.nativeApplicationVersion || "1.1.0"} · {Platform.OS === "android" ? "Android" : Platform.OS}
        </Text>
      </ClientScreen>
    </View>
  );
}

function Permission({ icon, title, text, enabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.icon}><Ionicons name={icon} size={23} color={colors.navy900} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={[styles.status, enabled && styles.statusEnabled]}>
        <Text style={[styles.statusText, enabled && styles.statusTextEnabled]}>{enabled ? "Ativo" : "Ativar"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  card: { borderRadius: 22, backgroundColor: colors.white, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "#E7EEF6", alignItems: "center", justifyContent: "center" },
  title: { color: colors.navy950, fontSize: 13, fontWeight: "900" },
  text: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  status: { borderRadius: 999, backgroundColor: "#FFF0E6", paddingHorizontal: 9, paddingVertical: 6 },
  statusEnabled: { backgroundColor: "#DFF4EA" },
  statusText: { color: colors.orange, fontSize: 8, fontWeight: "900" },
  statusTextEnabled: { color: colors.success },
  privacy: { borderRadius: 22, backgroundColor: "#DFF4EA", padding: 15, flexDirection: "row", gap: 11 },
  privacyText: { flex: 1, color: "#326B58", fontSize: 11, lineHeight: 17 },
  settingsButton: { minHeight: 53, borderRadius: 17, borderWidth: 1, borderColor: "#C6D1DB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  settingsText: { color: colors.navy900, fontWeight: "900" },
  version: { color: colors.muted, fontSize: 9, textAlign: "center" },
});
