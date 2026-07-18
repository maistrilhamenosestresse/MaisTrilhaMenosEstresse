import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  NativeUserLocation,
} from "@maplibre/maplibre-react-native";
import type { LatestLocation, OperationMember } from "../types";
import { colors } from "../theme";

type Props = {
  route?: Record<string, any> | null;
  members: OperationMember[];
  locations: LatestLocation[];
  mapStyle?: string;
};

export function TrailMap({ route, members, locations, mapStyle }: Props) {
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
});
