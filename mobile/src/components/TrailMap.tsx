import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LatestLocation, OperationMember } from "../types";
import { colors } from "../theme";
import { runtimeCapabilities } from "../runtimeCapabilities";

type Props = {
  route?: Record<string, any> | null;
  members: OperationMember[];
  locations: LatestLocation[];
  mapStyle?: string;
};

export function TrailMap({ route, members, locations, mapStyle }: Props) {
  if (!runtimeCapabilities.nativeOfflineMaps) {
    return <DemoTrailMap members={members} locations={locations} />;
  }

  return <NativeTrailMap route={route} members={members} locations={locations} mapStyle={mapStyle} />;
}

function NativeTrailMap({ route, members, locations, mapStyle }: Props) {
  const {
    Camera,
    GeoJSONSource,
    Layer,
    Map: MapLibreMap,
    NativeUserLocation,
  } = require("@maplibre/maplibre-react-native") as typeof import("@maplibre/maplibre-react-native");
  const memberById = useMemo(() => new globalThis.Map(members.map((member) => [member.id, member])), [members]);
  const points = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: locations.map((location) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [location.longitude, location.latitude],
      },
      properties: {
        id: location.member_id,
        name: memberById.get(location.member_id)?.display_name || "Participante",
        status: location.status,
      },
    })),
  }), [locations, memberById]);
  const center = locations.length
    ? [locations[0].longitude, locations[0].latitude] as [number, number]
    : [-47.8825, -15.7942] as [number, number];

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle || "https://demotiles.maplibre.org/style.json"}
        compass
        attribution={false}
        logo={false}
      >
        <Camera center={center} zoom={14} />
        <NativeUserLocation />
        {route ? (
          <GeoJSONSource id="trail-route" data={normalizeRoute(route) as any}>
            <Layer
              id="trail-halo"
              type="line"
              paint={{ "line-color": colors.white, "line-width": 8, "line-opacity": 0.8 }}
            />
            <Layer
              id="trail-line"
              type="line"
              paint={{ "line-color": colors.orange, "line-width": 4 }}
            />
          </GeoJSONSource>
        ) : null}
        <GeoJSONSource id="group-members" data={points}>
          <Layer
            id="member-points"
            type="circle"
            paint={{
              "circle-radius": 9,
              "circle-color": [
                "match",
                ["get", "status"],
                "sos", colors.danger,
                "help_requested", colors.warning,
                "rest_requested", "#E9B949",
                colors.success,
              ],
              "circle-stroke-color": colors.white,
              "circle-stroke-width": 3,
            }}
          />
        </GeoJSONSource>
      </MapLibreMap>
    </View>
  );
}

function DemoTrailMap({ members, locations }: Pick<Props, "members" | "locations">) {
  const visibleMembers = members.slice(0, 6);
  return (
    <View style={[styles.container, styles.demo]}>
      <View style={styles.demoGrid}>
        <View style={[styles.demoRoute, { transform: [{ rotate: "-18deg" }] }]} />
        <View style={[styles.demoRoute, styles.demoRouteSecondary, { transform: [{ rotate: "28deg" }] }]} />
      </View>
      <View style={styles.demoHeader}>
        <Text style={styles.demoEyebrow}>MAPA DE TESTE</Text>
        <Text style={styles.demoTitle}>Visualização simulada no Expo Go</Text>
        <Text style={styles.demoText}>
          {locations.length
            ? `${locations.length} posição(ões) recebida(s) do servidor`
            : "O mapa nativo e o download offline serão ativados na versão instalada."}
        </Text>
      </View>
      <View style={styles.demoMembers}>
        {visibleMembers.map((member, index) => (
          <View
            key={member.id}
            style={[
              styles.demoMarker,
              {
                left: `${12 + ((index * 17) % 72)}%`,
                top: `${48 + ((index * 19) % 35)}%`,
                backgroundColor: markerColor(member.last_status),
              },
            ]}
          >
            <Text style={styles.demoMarkerText}>{member.display_name?.slice(0, 1).toUpperCase() || "P"}</Text>
          </View>
        ))}
      </View>
      <View style={styles.demoBadge}>
        <Text style={styles.demoBadgeText}>Bluetooth e mapa offline simulados</Text>
      </View>
    </View>
  );
}

function markerColor(status: string) {
  if (status === "sos") return colors.danger;
  if (status === "help_requested") return colors.warning;
  if (status === "rest_requested") return "#C88719";
  return colors.success;
}

function normalizeRoute(route: Record<string, any>) {
  if (route.type === "FeatureCollection" || route.type === "Feature") return route;
  return {
    type: "Feature",
    properties: {},
    geometry: route.type ? route : { type: "LineString", coordinates: route.coordinates || [] },
  };
}

const styles = StyleSheet.create({
  container: {
    height: 360,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: colors.sky,
  },
  demo: {
    backgroundColor: colors.navy950,
    padding: 20,
    justifyContent: "space-between",
  },
  demoGrid: {
    position: "absolute",
    inset: 0,
    opacity: 0.22,
    overflow: "hidden",
  },
  demoRoute: {
    position: "absolute",
    width: "130%",
    height: 7,
    left: "-15%",
    top: "57%",
    borderRadius: 10,
    backgroundColor: colors.orange,
  },
  demoRouteSecondary: {
    top: "72%",
    backgroundColor: "#4F89B8",
  },
  demoHeader: { maxWidth: "82%" },
  demoEyebrow: { color: colors.orange, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  demoTitle: { color: colors.white, fontSize: 20, lineHeight: 25, fontWeight: "900", marginTop: 7 },
  demoText: { color: "#B7C9D7", fontSize: 12, lineHeight: 18, marginTop: 8 },
  demoMembers: { position: "absolute", inset: 0 },
  demoMarker: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  demoMarkerText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  demoBadge: {
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoBadgeText: { color: colors.white, fontSize: 11, fontWeight: "800" },
});
