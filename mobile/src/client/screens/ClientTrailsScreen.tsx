import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { getCurrentClient } from "../../api";
import { supabase } from "../../auth";
import { colors } from "../../theme";
import { ClientScreen, EmptyState, ErrorBanner, LoadingState, formatCurrency, formatDate } from "../ClientUi";
import type { ClientRoute, TrailRecord } from "../types";

type OwnedTrail = TrailRecord & { reservationId: string };

export function ClientTrailsScreen({
  session,
  navigate,
}: {
  session: Session;
  navigate: (route: ClientRoute) => void;
}) {
  const [tab, setTab] = useState<"mine" | "explore">("mine");
  const [mine, setMine] = useState<OwnedTrail[]>([]);
  const [explore, setExplore] = useState<TrailRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getCurrentClient(session);
        const today = new Date().toISOString().slice(0, 10);
        const [reservationsResult, agendasResult] = await Promise.all([
          supabase
            .from("reservas")
            .select("id, agendas(*)")
            .eq("client_id", profile.client.id)
            .eq("status_pagamento", "pago")
            .order("created_at", { ascending: false }),
          supabase
            .from("agendas")
            .select("*")
            .gte("date", today)
            .order("date", { ascending: true }),
        ]);
        if (reservationsResult.error) throw reservationsResult.error;
        if (agendasResult.error) throw agendasResult.error;
        setMine((reservationsResult.data || [])
          .filter((row: any) => row.agendas)
          .map((row: any) => ({ ...row.agendas, reservationId: row.id })));
        setExplore((agendasResult.data || []) as TrailRecord[]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar as trilhas.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const filtered = useMemo(
    () => explore.filter((trail) => trail.title.toLowerCase().includes(search.trim().toLowerCase())),
    [explore, search],
  );

  if (loading) return <LoadingState label="Buscando suas aventuras…" />;

  return (
    <ClientScreen>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}><Ionicons name="map" size={25} color={colors.orange} /></View>
        <View>
          <Text style={styles.eyebrow}>AVENTURAS</Text>
          <Text style={styles.title}>Suas trilhas</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "mine" && styles.tabActive]} onPress={() => setTab("mine")}>
          <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>Eu vou</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "explore" && styles.tabActive]} onPress={() => setTab("explore")}>
          <Text style={[styles.tabText, tab === "explore" && styles.tabTextActive]}>Explorar</Text>
        </TouchableOpacity>
      </View>

      {tab === "explore" ? (
        <View style={styles.search}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar destino…"
            placeholderTextColor="#81909E"
            style={styles.searchInput}
          />
        </View>
      ) : null}

      <ErrorBanner message={error} />

      {tab === "mine" ? (
        mine.length ? mine.map((trail) => (
          <TouchableOpacity
            key={`${trail.id}:${trail.reservationId}`}
            style={styles.mineCard}
            onPress={() => navigate({ name: "trail-detail", trail, owned: true })}
          >
            <View style={styles.mineTop}>
              <TrailImage trail={trail} />
              <View style={{ flex: 1 }}>
                <View style={styles.confirmed}><Text style={styles.confirmedText}>CONFIRMADO</Text></View>
                <Text style={styles.cardTitle}>{trail.title}</Text>
                <Text style={styles.meta}>{formatDate(trail.date)}</Text>
              </View>
            </View>
            <View style={styles.accessRow}>
              <View style={styles.accessItem}><Ionicons name="navigate" size={18} color="#3976B8" /><Text style={styles.accessText}>GPS liberado</Text></View>
              <View style={styles.accessItem}><Ionicons name="images" size={18} color={colors.orange} /><Text style={styles.accessText}>Álbum</Text></View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </TouchableOpacity>
        )) : (
          <EmptyState
            icon="trail-sign-outline"
            title="Nenhuma aventura marcada"
            text="Abra a aba Explorar para encontrar sua próxima trilha."
          />
        )
      ) : (
        filtered.length ? filtered.map((trail) => (
          <TouchableOpacity
            key={trail.id}
            style={styles.exploreCard}
            onPress={() => navigate({ name: "trail-detail", trail, owned: false })}
          >
            <TrailImage trail={trail} compact />
            <View style={{ flex: 1 }}>
              <Text style={styles.difficulty}>{trail.difficulty || "Nível a confirmar"}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{trail.title}</Text>
              <Text style={styles.meta}>{formatDate(trail.date)} · {trail.duration_hours || "—"}h</Text>
              <Text style={styles.price}>{formatCurrency(trail.price)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        )) : (
          <EmptyState title="Nenhuma trilha encontrada" text="Tente outro destino ou volte em breve." />
        )
      )}
    </ClientScreen>
  );
}

function TrailImage({ trail, compact }: { trail: TrailRecord; compact?: boolean }) {
  const source = trail.flyer_url || trail.images?.[0];
  return (
    <View style={[styles.imageWrap, compact && styles.imageCompact]}>
      {source ? (
        <Image source={{ uri: source }} style={styles.image} />
      ) : <Ionicons name="image-outline" size={34} color="#9BAAB6" />}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  titleIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.orange, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: colors.navy950, fontSize: 26, fontWeight: "900", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#E8EDF1", borderRadius: 18, padding: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.white },
  tabText: { color: colors.muted, fontWeight: "800" },
  tabTextActive: { color: colors.navy950, fontWeight: "900" },
  search: { minHeight: 50, borderRadius: 16, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  mineCard: { backgroundColor: colors.white, borderRadius: 25, padding: 15, gap: 14 },
  mineTop: { flexDirection: "row", gap: 13 },
  imageWrap: { width: 90, height: 90, borderRadius: 20, backgroundColor: "#E8EDF1", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  imageCompact: { width: 86, height: 86, borderRadius: 19 },
  image: { width: "100%", height: "100%" },
  confirmed: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#DFF5E9", paddingHorizontal: 8, paddingVertical: 4 },
  confirmedText: { color: colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  cardTitle: { color: colors.navy950, fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 6 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  accessRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: colors.background, padding: 12 },
  accessItem: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  accessText: { color: colors.text, fontSize: 10, fontWeight: "800" },
  exploreCard: { backgroundColor: colors.white, borderRadius: 23, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  difficulty: { alignSelf: "flex-start", color: colors.success, backgroundColor: "#E4F5EC", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  price: { color: colors.orange, fontSize: 15, fontWeight: "900", marginTop: 5 },
});
