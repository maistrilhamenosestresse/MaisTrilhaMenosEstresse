import { useEffect, useMemo, useState } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../auth";
import { TrailMap } from "../../components/TrailMap";
import { colors } from "../../theme";
import {
  ClientHeader,
  ClientScreen,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  formatCurrency,
  formatDate,
} from "../ClientUi";
import type { ClientRoute, TrailRecord } from "../types";

const DEFAULT_CHECKLIST = [
  "Mochila confortável",
  "Calçado com boa aderência",
  "Água suficiente para o percurso",
  "Lanche leve",
  "Protetor solar e repelente",
  "Documento de identidade",
];

export function ClientTrailDetailScreen({
  session,
  trail,
  owned,
  navigate,
  onBack,
}: {
  session: Session;
  trail: TrailRecord;
  owned: boolean;
  navigate: (route: ClientRoute) => void;
  onBack: () => void;
}) {
  const [route, setRoute] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const hero = trail.flyer_url || trail.images?.[0];
  const checklist = useMemo(
    () => trail.checklist_items?.length ? trail.checklist_items : DEFAULT_CHECKLIST,
    [trail.checklist_items],
  );

  useEffect(() => {
    if (!owned) return;
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("trilha_gpx")
          .select("*")
          .eq("agenda_id", trail.id)
          .maybeSingle();
        if (queryError) setError("O mapa desta trilha ainda não está disponível.");
        const candidate = data?.geojson || data?.route_geojson || data?.data || null;
        if (candidate) setRoute(typeof candidate === "string" ? JSON.parse(candidate) : candidate);
      } catch {
        setError("Não foi possível abrir o mapa da trilha.");
      }
    })();
  }, [owned, trail.id]);

  const openMeetingPoint = () => {
    const location = trail.location || (trail as any).meeting_point;
    if (location) void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`);
  };

  return (
    <View style={styles.page}>
      <ClientHeader title={trail.title} subtitle={owned ? "MINHA TRILHA" : "DETALHES"} onBack={onBack} />
      <ClientScreen>
        <View style={styles.hero}>
          {hero ? <Image source={{ uri: hero }} style={styles.heroImage} /> : (
            <Ionicons name="image-outline" size={52} color="#9EACB7" />
          )}
          <View style={styles.heroShade} />
          <View style={styles.heroCopy}>
            <Text style={styles.date}>{formatDate(trail.date)}</Text>
            <Text style={styles.heroTitle}>{trail.title}</Text>
            {!owned ? <Text style={styles.price}>{formatCurrency(trail.price)}</Text> : null}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon="footsteps" value={`${trail.distance_km || "—"} km`} label="Distância" />
          <Stat icon="time" value={`${trail.duration_hours || "—"} h`} label="Duração" />
          <Stat icon="speedometer" value={trail.difficulty || "A definir"} label="Nível" />
        </View>

        {trail.description ? <Text style={styles.description}>{trail.description}</Text> : null}
        <ErrorBanner message={error} />

        {owned ? (
          <>
            <View style={styles.safety}>
              <Ionicons name="shield-checkmark" size={26} color="#1D684D" />
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>Recursos da aventura liberados</Text>
                <Text style={styles.safetyText}>Mapa, localização do grupo, alertas e álbum ficam disponíveis para reservas pagas.</Text>
              </View>
            </View>
            <TrailMap route={route} members={[]} locations={[]} />
            <PrimaryButton
              label="Abrir segurança e rastreamento"
              icon="navigate"
              tone="navy"
              onPress={() => navigate({ name: "safety" } as ClientRoute)}
            />
            <SecondaryButton
              label="Abrir álbum da trilha"
              icon="images"
              onPress={() => navigate({ name: "album", agendaId: trail.id, title: trail.title })}
            />
          </>
        ) : (
          <PrimaryButton
            label="Adicionar ao carrinho"
            icon="cart"
            onPress={() => navigate({ name: "trail-checkout", trail })}
          />
        )}

        {(trail.location || (trail as any).meeting_point) ? (
          <TouchableOpacity style={styles.meeting} onPress={openMeetingPoint}>
            <Ionicons name="location" size={23} color="#3976B8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.meetingLabel}>PONTO DE ENCONTRO</Text>
              <Text style={styles.meetingValue}>{trail.location || (trail as any).meeting_point}</Text>
            </View>
            <Ionicons name="open-outline" size={19} color={colors.muted} />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.section}>LISTA RECOMENDADA</Text>
        <View style={styles.checklist}>
          {checklist.map((item, index) => (
            <View key={`${item}:${index}`} style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      </ClientScreen>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.orange} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { height: 260, borderRadius: 28, overflow: "hidden", backgroundColor: "#DDE5EA", alignItems: "center", justifyContent: "center" },
  heroImage: { width: "100%", height: "100%" },
  heroShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,18,33,0.34)" },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 18 },
  date: { color: "#D7E5EF", fontSize: 11, fontWeight: "800" },
  heroTitle: { color: colors.white, fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 4 },
  price: { color: "#FFD1B2", fontSize: 18, fontWeight: "900", marginTop: 6 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, minHeight: 96, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", padding: 9 },
  statValue: { color: colors.navy950, fontSize: 12, fontWeight: "900", marginTop: 5 },
  statLabel: { color: colors.muted, fontSize: 8, marginTop: 2 },
  description: { color: colors.text, fontSize: 13, lineHeight: 21, backgroundColor: colors.white, borderRadius: 22, padding: 17 },
  safety: { flexDirection: "row", gap: 12, borderRadius: 21, backgroundColor: "#DFF4EA", padding: 15 },
  safetyTitle: { color: "#155A42", fontWeight: "900" },
  safetyText: { color: "#39705E", fontSize: 11, lineHeight: 17, marginTop: 3 },
  meeting: { borderRadius: 21, backgroundColor: colors.white, padding: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  meetingLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  meetingValue: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 3 },
  section: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  checklist: { borderRadius: 22, backgroundColor: colors.white, padding: 15, gap: 12 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "700" },
});
