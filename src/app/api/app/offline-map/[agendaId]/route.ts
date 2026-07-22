import { NextResponse } from "next/server";
import { requireAgendaCustomer } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 45;

type Coordinate = [number, number, number?];
type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request, context: { params: Promise<{ agendaId: string }> }) {
  const { agendaId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(agendaId)) {
    return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });
  }

  const auth = await requireAgendaCustomer(agendaId);
  if (auth.response) return auth.response;

  const limited = await enforceRateLimit(request, `offline-map:${agendaId}`, 8, 3600);
  if (limited) return limited;

  const supabase = createSupabaseAdmin();
  const documentKey = `offline-map:v2:${agendaId}`;
  const { data: cached } = await supabase
    .from("content_documents")
    .select("structured_content, updated_at")
    .eq("document_key", documentKey)
    .maybeSingle();

  if (cached?.structured_content && cached.updated_at) {
    const age = Date.now() - new Date(cached.updated_at).getTime();
    if (age < CACHE_MAX_AGE_MS) return privateJson(cached.structured_content);
  }

  const { data: route, error: routeError } = await supabase
    .from("trilha_gpx")
    .select("geojson")
    .eq("agenda_id", agendaId)
    .maybeSingle();
  if (routeError || !route?.geojson) {
    return NextResponse.json({ error: "A rota GPS precisa estar cadastrada antes de baixar o mapa." }, { status: 404 });
  }

  const coordinates = extractRouteCoordinates(route.geojson);
  if (coordinates.length < 2) {
    return NextResponse.json({ error: "A rota GPS não possui coordenadas válidas." }, { status: 422 });
  }

  const bounds = paddedBounds(coordinates, 0.012);
  if ((bounds.north - bounds.south) > 1 || (bounds.east - bounds.west) > 1) {
    return NextResponse.json({ error: "A área desta rota é muito extensa para um único pacote offline." }, { status: 422 });
  }

  const query = buildOverpassQuery(bounds);
  let elements: OsmElement[] | null = null;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "MaisTrilhaMenosEstresse/1.0 (contato@maistrilhasmenosestresse.com)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Overpass respondeu ${response.status}`);
      const payload = await response.json() as { elements?: OsmElement[] };
      elements = payload.elements || [];
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!elements) {
    console.error("Falha ao gerar pacote offline:", lastError);
    return NextResponse.json({ error: "O serviço de mapas está ocupado. Tente baixar novamente em alguns minutos." }, { status: 503 });
  }

  const featureCollection = toFeatureCollection(elements);
  const result = {
    agendaId,
    version: 2,
    generatedAt: new Date().toISOString(),
    bounds,
    featureCount: featureCollection.features.length,
    attribution: "© OpenStreetMap contributors · ODbL",
    geojson: featureCollection,
  };

  await supabase.from("content_documents").upsert({
    document_key: documentKey,
    title: `Mapa offline da trilha ${agendaId}`,
    structured_content: result,
    mime_type: "application/geo+json",
    published: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "document_key" });

  return privateJson(result);
}

function extractRouteCoordinates(input: unknown): Coordinate[] {
  const value = input as any;
  const geometry = value?.type === "FeatureCollection"
    ? value.features?.find((feature: any) => feature?.geometry)?.geometry
    : value?.type === "Feature"
      ? value.geometry
      : value;
  if (!geometry?.coordinates) return [];
  const raw = geometry.type === "MultiLineString" ? geometry.coordinates.flat() : geometry.coordinates;
  return Array.isArray(raw)
    ? raw.filter((item: unknown) => Array.isArray(item) && Number.isFinite((item as number[])[0]) && Number.isFinite((item as number[])[1]))
    : [];
}

function paddedBounds(coordinates: Coordinate[], padding: number) {
  const longitudes = coordinates.map((item) => item[0]);
  const latitudes = coordinates.map((item) => item[1]);
  return {
    south: Math.max(-85, Math.min(...latitudes) - padding),
    west: Math.max(-180, Math.min(...longitudes) - padding),
    north: Math.min(85, Math.max(...latitudes) + padding),
    east: Math.min(180, Math.max(...longitudes) + padding),
  };
}

function buildOverpassQuery(bounds: ReturnType<typeof paddedBounds>) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:25];(
    way["highway"](${bbox});
    way["waterway"](${bbox});
    way["natural"~"water|wood|scrub|grassland"](${bbox});
    way["landuse"~"forest|meadow|grass|recreation_ground"](${bbox});
    node["natural"~"peak|waterfall|spring|cave_entrance"](${bbox});
    node["tourism"~"viewpoint|camp_site|picnic_site|attraction"](${bbox});
    node["amenity"~"shelter|drinking_water|toilets"](${bbox});
    node["highway"="trailhead"](${bbox});
    node["ford"](${bbox});
    node["barrier"="gate"](${bbox});
  );out tags geom qt 3500;`;
}

function toFeatureCollection(elements: OsmElement[]) {
  const features: Array<{
    type: "Feature";
    id: string;
    properties: ReturnType<typeof sanitizeProperties>;
    geometry: { type: "Point" | "LineString" | "Polygon"; coordinates: unknown };
  }> = [];
  for (const element of elements) {
    const properties = sanitizeProperties(element);
    if (element.type === "node" && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      features.push({ type: "Feature", id: `node/${element.id}`, properties, geometry: { type: "Point", coordinates: [element.lon, element.lat] } });
      continue;
    }
    if (element.type !== "way" || !element.geometry || element.geometry.length < 2) continue;
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);
    const closed = coordinates.length > 3 && coordinates[0][0] === coordinates.at(-1)?.[0] && coordinates[0][1] === coordinates.at(-1)?.[1];
    const area = closed && Boolean(element.tags?.natural || element.tags?.landuse);
    features.push({
      type: "Feature",
      id: `way/${element.id}`,
      properties,
      geometry: area ? { type: "Polygon", coordinates: [coordinates] } : { type: "LineString", coordinates },
    });
  }
  return { type: "FeatureCollection", features };
}

function sanitizeProperties(element: OsmElement) {
  const tags = element.tags || {};
  const pointOfInterest = element.type === "node";
  const kind = pointOfInterest ? (tags.natural === "spring" || tags.natural === "waterfall" || tags.amenity === "drinking_water" ? "water" : "landmark")
    : tags.highway ? "path"
    : tags.waterway || tags.natural === "water" ? "water"
      : tags.natural || tags.landuse ? "nature"
        : "landmark";
  return {
    kind,
    name: String(tags.name || tags["name:pt"] || "").slice(0, 120),
    subtype: String(tags.highway || tags.waterway || tags.natural || tags.landuse || tags.tourism || tags.amenity || tags.barrier || (tags.ford ? "ford" : "")).slice(0, 60),
    surface: String(tags.surface || "").slice(0, 40),
  };
}

function privateJson(value: unknown) {
  return NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
}
