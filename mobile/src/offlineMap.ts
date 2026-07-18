import { setState } from "./storage";
import { runtimeCapabilities } from "./runtimeCapabilities";

type Bounds = [number, number, number, number];

export async function downloadOfflineMap(input: {
  operationId: string;
  mapStyle: string;
  bounds: Bounds;
  minZoom?: number;
  maxZoom?: number;
  onProgress?: (percentage: number) => void;
}) {
  if (!runtimeCapabilities.nativeOfflineMaps) {
    throw new Error("O mapa offline real exige o aplicativo nativo. Neste teste do iPhone ele está simulado.");
  }
  const { OfflineManager } = require("@maplibre/maplibre-react-native") as typeof import("@maplibre/maplibre-react-native");
  const pack = await OfflineManager.createPack(
    {
      mapStyle: input.mapStyle,
      bounds: input.bounds,
      minZoom: input.minZoom ?? 10,
      maxZoom: input.maxZoom ?? 17,
      metadata: {
        operationId: input.operationId,
        name: `Mais Trilha ${input.operationId.slice(0, 8)}`,
      },
    },
    (_pack, status) => input.onProgress?.(status.percentage || 0),
    (_pack, error) => {
      throw new Error(error.message || "Falha ao baixar mapa");
    },
  );
  await setState(`offline_map:${input.operationId}`, { packId: pack.id, downloadedAt: new Date().toISOString() });
  return pack.id;
}

export function routeBounds(geojson: Record<string, any> | null | undefined): Bounds | null {
  const coordinates: number[][] = [];
  collectCoordinates(geojson, coordinates);
  if (!coordinates.length) return null;
  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);
  const padding = 0.01;
  return [
    Math.min(...longitudes) - padding,
    Math.min(...latitudes) - padding,
    Math.max(...longitudes) + padding,
    Math.max(...latitudes) + padding,
  ];
}

function collectCoordinates(value: unknown, output: number[][]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      output.push(value as number[]);
      return;
    }
    value.forEach((entry) => collectCoordinates(entry, output));
    return;
  }
  Object.values(value as Record<string, unknown>).forEach((entry) => collectCoordinates(entry, output));
}
