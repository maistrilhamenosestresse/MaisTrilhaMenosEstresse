"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip, Circle, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { getOfflineMapPack, getOfflineTrail, saveOfflineTrail } from "@/lib/app/offline-trails";
import { useNetworkStatus } from "@/lib/app/use-network-status";

// ---------------------------------------------------------
// Ícones Customizados
// ---------------------------------------------------------

const createHtmlIcon = (html: string, size: [number, number], anchor: [number, number]) => L.divIcon({
  html,
  className: '',
  iconSize: size,
  iconAnchor: anchor
});

// Marcadores de Início e Fim (Estilo Premium)
const startIcon = createHtmlIcon(
  `<div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
  [24, 24], [12, 12]
);

const endIcon = createHtmlIcon(
  `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 4px; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background-color: white; border-radius: 1px;"></div></div>`,
  [24, 24], [12, 12]
);

// Cursor de Elevação (Bolinha Laranja que anda pelo mapa)
const cursorIcon = createHtmlIcon(
  `<div style="background-color: #f97316; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(249,115,22,0.8); transition: all 0.1s;"></div>`,
  [16, 16], [8, 8]
);

// ---------------------------------------------------------

function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [map]);
  return null;
}

function MapController({ center, zoom, centerRequest }: { center: [number, number] | null, zoom: number, centerRequest?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && centerRequest !== undefined && centerRequest > 0) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    } else if (center) {
      map.panTo(center, { animate: true, duration: 0.5 });
    }
  }, [center, map, zoom, centerRequest]);
  return null;
}

function RouteViewport({ coordinates, tracking }: { coordinates: [number, number, number?][]; tracking: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (tracking || coordinates.length < 2) return;
    const bounds = L.latLngBounds(coordinates.map((point) => [point[0], point[1]] as [number, number]));
    map.fitBounds(bounds, {
      paddingTopLeft: [34, 118],
      paddingBottomRight: [34, 168],
      maxZoom: 16,
      animate: false,
    });
  }, [coordinates, map, tracking]);
  return null;
}

export interface ImmersiveMapProps {
  agendaId?: string;
  onElevationData?: (data: { distance: number, elevation: number, lat: number, lng: number }[]) => void;
  hoverIndex?: number | null;
  layerMode?: "street" | "satellite" | "topo" | "offline";
  offlineContextGeojson?: unknown | null;
  trackingPos?: { lat: number; lng: number; heading?: number | null } | null;
  walkedIndex?: number;
  isTracking?: boolean;
  centerRequest?: number;
  onOfflineAvailabilityChange?: (available: boolean, usingOfflineCopy: boolean) => void;
}

// Ícone de posição do usuário - agora gerado dinamicamente com SVG
const getUserPosIcon = (heading: number | null | undefined) => {
  const rotation = heading !== null && heading !== undefined ? heading : 0;
  return L.divIcon({
    html: `
      <div style="transform: rotate(${rotation}deg); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="#3b82f6" stroke="white" stroke-width="2" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
          <path d="M12 2L21 21L12 17L3 21L12 2Z" />
        </svg>
      </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default function ImmersiveMap({
  agendaId,
  onElevationData,
  hoverIndex,
  layerMode = "topo",
  trackingPos,
  walkedIndex = 0,
  isTracking = false,
  centerRequest = 0,
  onOfflineAvailabilityChange,
  offlineContextGeojson,
}: ImmersiveMapProps) {
  const [coordinates, setCoordinates] = useState<[number, number, number?][]>([]);
  const [elevationProfile, setElevationProfile] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeError, setRouteError] = useState("");
  const [storedOfflineContext, setStoredOfflineContext] = useState<unknown | null>(null);
  const online = useNetworkStatus();
  const contextualMap = offlineContextGeojson === undefined ? storedOfflineContext : offlineContextGeojson;
  const effectiveLayerMode = (!online && contextualMap) ? "offline" : layerMode;

  useEffect(() => {
    if (!agendaId || offlineContextGeojson !== undefined) return;
    const load = () => void getOfflineMapPack(agendaId).then((pack) => setStoredOfflineContext(pack?.geojson || null)).catch(() => undefined);
    const updated = (event: Event) => {
      const detail = (event as CustomEvent<{ agendaId?: string }>).detail;
      if (detail?.agendaId === agendaId) load();
    };
    load();
    window.addEventListener("mt:offline-map-updated", updated);
    return () => window.removeEventListener("mt:offline-map-updated", updated);
  }, [agendaId, offlineContextGeojson]);

  useEffect(() => {
    async function fetchGpxData() {
      if (!agendaId) {
        setRouteError("Rota GPS não cadastrada.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setRouteError("");
      try {
        const offline = await getOfflineTrail(agendaId).catch(() => null);
        let geojson = offline?.geojson;
        let usingOfflineCopy = false;
        if (navigator.onLine) {
          const { data, error } = await supabase.from('trilha_gpx').select('geojson').eq('agenda_id', agendaId).single();
          if (!error && data?.geojson) {
            geojson = data.geojson;
            await saveOfflineTrail(agendaId, geojson).catch(() => undefined);
          } else {
            usingOfflineCopy = Boolean(offline);
          }
        } else {
          usingOfflineCopy = Boolean(offline);
        }
        if (!geojson) {
          onOfflineAvailabilityChange?.(false, false);
          setRouteError(navigator.onLine ? "Rota GPS ainda não cadastrada para esta trilha." : "Rota não salva neste aparelho. Abra o mapa uma vez com internet.");
          return;
        }
        onOfflineAvailabilityChange?.(true, usingOfflineCopy);

        let rawCoordinates: number[][] | null = null;
        const route = geojson as any;
        if (Array.isArray(route.coordinates)) rawCoordinates = route.coordinates;
        else if (route.type === "FeatureCollection" && route.features?.[0]?.geometry?.coordinates) rawCoordinates = route.features[0].geometry.coordinates;
        else if (route.type === "Feature" && route.geometry?.coordinates) rawCoordinates = route.geometry.coordinates;

        if (rawCoordinates && Array.isArray(rawCoordinates)) {
          const leafletCoords = rawCoordinates.map(c => [c[1], c[0], c[2] || 0] as [number, number, number?]);
          setCoordinates(leafletCoords);

          // Gerar perfil de elevação com lat/lng atrelado
          function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
            const R = 6371; 
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
            return R * c;
          }

          let totalDistance = 0;
          const profile = leafletCoords.map((coord, i) => {
            if (i > 0) {
              const prev = leafletCoords[i-1];
              totalDistance += getDistanceFromLatLonInKm(prev[0], prev[1], coord[0], coord[1]);
            }
            return { distance: parseFloat(totalDistance.toFixed(2)), elevation: coord[2] || 0, lat: coord[0], lng: coord[1] };
          });
          
          setElevationProfile(profile);
          if (onElevationData) onElevationData(profile);
        }
      } catch (err) {
        console.error(err);
        setRouteError("Não foi possível abrir a rota GPS.");
      } finally {
        setLoading(false);
      }
    }
    fetchGpxData();
  }, [agendaId, online, onElevationData, onOfflineAvailabilityChange]);

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center bg-[#101923] text-sm font-bold text-slate-400">Preparando rota GPS...</div>;
  }

  if (coordinates.length === 0) {
    return <div className="flex h-full w-full flex-col items-center justify-center bg-[#101923] p-6 text-center"><div className="mb-3 text-3xl">🧭</div><p className="font-black text-white">Rota indisponível</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">{routeError}</p></div>;
  }

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  
  const cursorPoint = (hoverIndex !== null && hoverIndex !== undefined && elevationProfile[hoverIndex]) 
    ? [elevationProfile[hoverIndex].lat, elevationProfile[hoverIndex].lng] as [number, number]
    : null;

  // Divide a trilha em segmentos: percorrido (vermelho) e à frente (verde)
  const walkedCoords = isTracking ? (coordinates.slice(0, walkedIndex + 1) as [number, number][]) : [];
  const aheadCoords = isTracking ? (coordinates.slice(walkedIndex) as [number, number][]) : (coordinates as [number, number][]);

  return (
    <div className={`relative z-0 h-full w-full ${effectiveLayerMode === "offline" ? "bg-[#e9ede4]" : "bg-[radial-gradient(circle_at_center,#263849,#101923_70%)]"}`}>
      <MapContainer 
        center={[startPoint[0], startPoint[1]]} 
        zoom={13}
        zoomControl={false}
        preferCanvas
        zoomSnap={0.5}
        className="mt-immersive-map w-full h-full"
      >
        <ResizeHandler />
        <RouteViewport coordinates={coordinates} tracking={isTracking} />
        <ZoomControl position="bottomleft" zoomInTitle="Aproximar" zoomOutTitle="Afastar" />
        {/* Controla o mapa quando o GPS está rastreando */}
        {isTracking && trackingPos && (
          <MapController center={[trackingPos.lat, trackingPos.lng]} zoom={16} centerRequest={centerRequest} />
        )}

        {/* Camada de Tile controlada por layerMode */}
        {effectiveLayerMode === "satellite" ? (
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        ) : effectiveLayerMode === "topo" ? (
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={18}
            maxZoom={20}
          />
        ) : effectiveLayerMode === "street" ? (
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />
        ) : null}

        {effectiveLayerMode === "offline" && contextualMap ? (
          <GeoJSON
            key={`offline-context-${agendaId}`}
            data={contextualMap as any}
            style={(feature) => offlineFeatureStyle(feature?.properties?.kind, feature?.properties?.subtype)}
            pointToLayer={(feature, latlng) => L.circleMarker(latlng, {
              radius: 6,
              color: "#ffffff",
              weight: 2,
              fillColor: feature?.properties?.kind === "water" ? "#38bdf8" : "#f59e0b",
              fillOpacity: 0.95,
            })}
            onEachFeature={(feature, layer) => {
              const name = feature?.properties?.name;
              const label = offlineFeatureLabel(feature?.properties?.subtype);
              if (name) layer.bindTooltip(String(name), { sticky: true, direction: "top" });
              layer.bindPopup(
                `<div style="min-width:140px"><strong>${escapeMapText(name || label)}</strong><br><span style="color:#64748b;font-size:11px">${escapeMapText(label)}</span></div>`,
              );
            }}
          />
        ) : null}

        {/* Trilha: laranja normal / verde+vermelho quando rastreando */}
        {!isTracking && (
          <>
            <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }} />
            <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#ea5b20', weight: 5.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
          </>
        )}
        {isTracking && walkedCoords.length > 1 && (
          <>
            <Polyline positions={walkedCoords} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round' }} />
            <Polyline positions={walkedCoords} pathOptions={{ color: '#f97316', weight: 6, opacity: 1, lineCap: 'round' }} />
          </>
        )}
        {isTracking && aheadCoords.length > 1 && (
          <>
            <Polyline positions={aheadCoords} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round' }} />
            <Polyline positions={aheadCoords} pathOptions={{ color: '#16a34a', weight: 6, opacity: 1, lineCap: 'round' }} />
          </>
        )}
        {/* Marcador de posição do usuário */}
        {isTracking && trackingPos && (
          <>
            <Circle center={[trackingPos.lat, trackingPos.lng]} radius={40} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }} />
            <Marker position={[trackingPos.lat, trackingPos.lng]} icon={getUserPosIcon(trackingPos.heading)} zIndexOffset={2000} />
          </>
        )}

        <Marker position={[startPoint[0], startPoint[1]]} icon={startIcon}>
          <Tooltip direction="top" offset={[0, -10]} className="bg-gray-900 text-white font-bold border-none shadow-xl">Início da Trilha</Tooltip>
        </Marker>

        <Marker position={[endPoint[0], endPoint[1]]} icon={endIcon}>
          <Tooltip direction="top" offset={[0, -10]} className="bg-gray-900 text-white font-bold border-none shadow-xl">Chegada da trilha</Tooltip>
        </Marker>

        {/* Cursor do Gráfico de Elevação */}
        {cursorPoint && (
          <Marker position={cursorPoint} icon={cursorIcon} zIndexOffset={1000} />
        )}
      </MapContainer>
      {!online && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[70%] rounded-xl border border-white/15 bg-[#071829]/90 px-3 py-2 text-[10px] font-bold leading-relaxed text-white shadow-lg backdrop-blur">
          {contextualMap ? "Pacote offline ativo: mapa, rota e GPS disponíveis." : "Sem sinal: GPS e rota continuam ativos. Baixe o mapa completo antes da trilha."}
        </div>
      )}
      {effectiveLayerMode === "offline" && contextualMap ? (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-lg bg-[#071829]/85 px-2 py-1 text-[8px] font-bold text-white/70">© OpenStreetMap contributors</div>
      ) : null}
    </div>
  );
}

function offlineFeatureStyle(kind?: string, subtype?: string): L.PathOptions {
  if (kind === "water") return { color: "#3b82c4", weight: 2, fillColor: "#9dd9ee", fillOpacity: 0.72 };
  if (kind === "nature") return { color: "#9bb889", weight: 0.7, fillColor: "#cdddbf", fillOpacity: 0.62 };
  if (kind === "path") {
    const major = ["primary", "secondary", "tertiary", "residential"].includes(subtype || "");
    const trail = ["path", "footway", "track", "bridleway", "steps"].includes(subtype || "");
    return {
      color: major ? "#ffffff" : trail ? "#9b7653" : "#c4c8bd",
      weight: major ? 4 : trail ? 2.2 : 1.2,
      opacity: major ? 0.96 : trail ? 0.78 : 0.48,
      dashArray: trail ? "4 4" : undefined,
    };
  }
  return { color: "#d97706", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.88 };
}

function offlineFeatureLabel(subtype?: string) {
  const labels: Record<string, string> = {
    path: "Trilha",
    footway: "Caminho a pé",
    track: "Estrada de terra",
    steps: "Escadaria",
    trailhead: "Início de trilha",
    viewpoint: "Mirante",
    waterfall: "Cachoeira",
    spring: "Nascente",
    cave_entrance: "Entrada de caverna",
    camp_site: "Área de camping",
    picnic_site: "Área de descanso",
    shelter: "Abrigo",
    drinking_water: "Água potável",
    toilets: "Banheiro",
    gate: "Porteira",
    ford: "Travessia de água",
  };
  return labels[subtype || ""] || "Ponto de referência";
}

function escapeMapText(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
