import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getPassport } from "../../api";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen, EmptyState, ErrorBanner, LoadingState, formatDate } from "../ClientUi";

export function ClientPassportScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getPassport(session)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao carregar passaporte."));
  }, [session]);

  if (!data && !error) return <LoadingState label="Carimbando seu passaporte…" />;

  return (
    <View style={styles.page}>
      <ClientHeader title="Passaporte de Trilhas" subtitle="CONQUISTAS" onBack={onBack} />
      <ClientScreen>
        <View style={styles.hero}>
          <Ionicons name="map" size={42} color="#FFD4B8" />
          <Text style={styles.name}>{data?.participant?.fullName || "Aventureiro"}</Text>
          <Text style={styles.heroText}>Cada trilha concluída deixa uma história e um novo selo.</Text>
          <View style={styles.stats}>
            <Stat value={data?.summary?.completedCount || 0} label="Concluídas" />
            <Stat value={`${Number(data?.summary?.totalDistanceKm || 0).toFixed(1)} km`} label="Distância" />
            <Stat value={data?.summary?.upcomingCount || 0} label="Próximas" />
          </View>
        </View>
        <ErrorBanner message={error} />
        <View style={styles.milestone}>
          <Ionicons name="trophy" size={24} color="#A66C00" />
          <View style={{ flex: 1 }}>
            <Text style={styles.milestoneTitle}>Próxima conquista</Text>
            <Text style={styles.milestoneText}>Complete {data?.summary?.nextMilestone || 3} trilhas para alcançar o próximo marco.</Text>
          </View>
        </View>
        <Text style={styles.section}>SELOS CONQUISTADOS</Text>
        {(data?.completed || []).length ? (data?.completed || []).map((trail: any) => (
          <View key={trail.id} style={styles.trail}>
            <View style={styles.imageWrap}>
              {trail.flyer_url ? <Image source={{ uri: trail.flyer_url }} style={styles.image} /> : <Ionicons name="footsteps" size={25} color={colors.orange} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trailTitle}>{trail.title}</Text>
              <Text style={styles.trailMeta}>{formatDate(trail.date)} · {trail.distance_km || "—"} km</Text>
            </View>
            <View style={styles.stamp}><Ionicons name="checkmark" size={18} color={colors.white} /></View>
          </View>
        )) : <EmptyState icon="map-outline" title="Seu primeiro selo está esperando" text="Conclua uma trilha para começar seu passaporte." />}
      </ClientScreen>
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { borderRadius: 28, backgroundColor: colors.navy950, padding: 20, alignItems: "center" },
  name: { color: colors.white, fontSize: 22, fontWeight: "900", marginTop: 10 },
  heroText: { color: "#B6C7D5", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 },
  stats: { width: "100%", flexDirection: "row", marginTop: 20, paddingTop: 17, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
  statValue: { color: colors.white, fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CB6C8", fontSize: 8, fontWeight: "800", marginTop: 3 },
  milestone: { borderRadius: 22, backgroundColor: "#FFF0B8", padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  milestoneTitle: { color: "#684500", fontSize: 13, fontWeight: "900" },
  milestoneText: { color: "#8A6109", fontSize: 10, lineHeight: 15, marginTop: 2 },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  trail: { borderRadius: 20, backgroundColor: colors.white, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  imageWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  trailTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  trailMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  stamp: { width: 32, height: 32, borderRadius: 13, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});
