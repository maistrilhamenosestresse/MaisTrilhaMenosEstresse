import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function StatusPill({ peers, online, relayed }: { peers: number; online: boolean; relayed: number }) {
  return (
    <View style={styles.row}>
      <View style={[styles.pill, online ? styles.online : styles.offline]}>
        <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.warning }]} />
        <Text style={styles.text}>{online ? "Servidor conectado" : "Modo offline"}</Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.text}>{peers} perto · {relayed} repasses</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  online: { borderColor: "#B9E7D5", borderWidth: 1 },
  offline: { borderColor: "#F5D4A9", borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.text, fontSize: 12, fontWeight: "700" },
});
