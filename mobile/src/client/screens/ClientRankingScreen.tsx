import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getRanking } from "../../api";
import { colors } from "../../theme";
import { ClientScreen, ErrorBanner, LoadingState } from "../ClientUi";

export function ClientRankingScreen({ session }: { session: Session }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getRanking(session)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao carregar ranking."));
  }, [session]);

  if (!data && !error) return <LoadingState label="Calculando a classificação…" />;

  return (
    <ClientScreen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="trophy" size={86} color="rgba(255,255,255,0.10)" style={styles.heroIcon} />
        <Text style={styles.eyebrow}>CLASSIFICAÇÃO GERAL</Text>
        <Text style={styles.title}>Desbrave o topo!</Text>
        <Text style={styles.subtitle}>Trilhas e compras rendem pontos, níveis e novas conquistas.</Text>
      </View>

      <View style={styles.myCard}>
        <View>
          <Text style={styles.myLabel}>SUA POSIÇÃO</Text>
          <Text style={styles.position}>{data?.myPosition ? `${data.myPosition}º` : "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.myLabel}>SEUS PONTOS</Text>
          <Text style={styles.points}>{Number(data?.myPoints || 0).toLocaleString("pt-BR")}</Text>
        </View>
      </View>

      <ErrorBanner message={error} />
      <Text style={styles.listTitle}>Aventureiros em destaque</Text>

      {(data?.ranking || []).map((entry: any, index: number) => (
        <View key={entry.position} style={[styles.row, entry.isMe && styles.myRow]}>
          <View style={[styles.medal, index === 0 && styles.gold, index === 1 && styles.silver, index === 2 && styles.bronze]}>
            <Text style={styles.medalText}>#{entry.position}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, entry.isMe && styles.myName]}>{entry.name}{entry.isMe ? " (Você)" : ""}</Text>
            <Text style={styles.level}>{levelFor(Number(entry.points || 0))}</Text>
          </View>
          <Text style={styles.rowPoints}>{Number(entry.points || 0).toLocaleString("pt-BR")} ★</Text>
        </View>
      ))}
    </ClientScreen>
  );
}

function levelFor(points: number) {
  if (points > 4000) return "Lenda da Trilha";
  if (points > 2000) return "Explorador";
  if (points > 500) return "Aventureiro";
  return "Iniciante";
}

const styles = StyleSheet.create({
  content: { padding: 0, paddingBottom: 115, gap: 12 },
  hero: { backgroundColor: colors.navy950, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 58, overflow: "hidden" },
  heroIcon: { position: "absolute", right: 4, top: 10 },
  eyebrow: { color: "#F7B98E", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  title: { color: colors.white, fontSize: 30, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#B6C7D5", fontSize: 12, lineHeight: 18, maxWidth: "80%", marginTop: 7 },
  myCard: { marginHorizontal: 16, marginTop: -34, backgroundColor: colors.white, borderRadius: 25, padding: 19, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: colors.navy950, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5 },
  myLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  position: { color: colors.orange, fontSize: 27, fontWeight: "900", marginTop: 3 },
  points: { color: colors.navy950, fontSize: 25, fontWeight: "900", marginTop: 3 },
  divider: { width: 1, height: 40, backgroundColor: "#DDE5EA" },
  listTitle: { color: colors.navy950, fontSize: 18, fontWeight: "900", marginHorizontal: 16, marginTop: 8 },
  row: { marginHorizontal: 16, backgroundColor: colors.white, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E4E9ED" },
  myRow: { backgroundColor: "#FFF0E6", borderColor: "#F6C8AA" },
  medal: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#E8EDF1", alignItems: "center", justifyContent: "center" },
  gold: { backgroundColor: "#FFF0B8" },
  silver: { backgroundColor: "#E1E5E8" },
  bronze: { backgroundColor: "#F5D2B7" },
  medalText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  name: { color: colors.text, fontSize: 13, fontWeight: "900" },
  myName: { color: "#A54618" },
  level: { color: colors.muted, fontSize: 10, marginTop: 2 },
  rowPoints: { color: colors.navy950, fontSize: 12, fontWeight: "900" },
});
