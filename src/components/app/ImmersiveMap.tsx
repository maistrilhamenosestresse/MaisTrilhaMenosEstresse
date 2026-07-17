"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap, LayersControl, Tooltip, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Camera, Droplets, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { renderToStaticMarkup } from "react-dom/server";

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

// POIs
const cameraIconHtml = renderToStaticMarkup(
  <div className="bg-white/90 backdrop-blur text-blue-600 p-2 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
    <Camera className="w-5 h-5" />
  </div>
);
const cameraIcon = createHtmlIcon(cameraIconHtml, [40, 40], [20, 20]);

const waterIconHtml = renderToStaticMarkup(
  <div className="bg-white/90 backdrop-blur text-cyan-500 p-2 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
    <Droplets className="w-5 h-5" />
  </div>
);
const waterIcon = createHtmlIcon(waterIconHtml, [40, 40], [20, 20]);

const viewpointIconHtml = renderToStaticMarkup(
  <div className="bg-white/90 backdrop-blur text-purple-600 p-2 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
    <Eye className="w-5 h-5" />
  </div>
);
const viewpointIcon = createHtmlIcon(viewpointIconHtml, [40, 40], [20, 20]);

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

export interface ImmersiveMapProps {
  agendaId?: string;
  onElevationData?: (data: { distance: number, elevation: number, lat: number, lng: number }[]) => void;
  hoverIndex?: number | null;
  layerMode?: "satellite" | "topo";
  trackingPos?: { lat: number; lng: number; heading?: number | null } | null;
  walkedIndex?: number;
  isTracking?: boolean;
  centerRequest?: number;
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

export default function ImmersiveMap({ agendaId, onElevationData, hoverIndex, layerMode = "satellite", trackingPos, walkedIndex = 0, isTracking = false, centerRequest = 0 }: ImmersiveMapProps) {
  const [coordinates, setCoordinates] = useState<[number, number, number?][]>([]);
  const [elevationProfile, setElevationProfile] = useState<any[]>([]);

  useEffect(() => {
    async function fetchGpxData() {
      if (!agendaId) return;
      try {
        const { data, error } = await supabase.from('trilha_gpx').select('geojson').eq('agenda_id', agendaId).single();
        if (error || !data?.geojson) return;

        let rawCoordinates: number[][] | null = null;
        if (Array.isArray(data.geojson.coordinates)) rawCoordinates = data.geojson.coordinates;
        else if (data.geojson.type === "FeatureCollection" && data.geojson.features?.[0]?.geometry?.coordinates) rawCoordinates = data.geojson.features[0].geometry.coordinates;
        else if (data.geojson.type === "Feature" && data.geojson.geometry?.coordinates) rawCoordinates = data.geojson.geometry.coordinates;

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
      }
    }
    fetchGpxData();
  }, [agendaId, onElevationData]);

  if (coordinates.length === 0) {
    return <div className="w-full h-full bg-gray-900 animate-pulse flex items-center justify-center text-gray-500">Carregando mapa orbital...</div>;
  }

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  
  // Encontrar alguns pontos no meio para simular POIs
  const midPoint1 = coordinates[Math.floor(coordinates.length * 0.25)];
  const midPoint2 = coordinates[Math.floor(coordinates.length * 0.5)];
  const midPoint3 = coordinates[Math.floor(coordinates.length * 0.75)];

  const cursorPoint = (hoverIndex !== null && hoverIndex !== undefined && elevationProfile[hoverIndex]) 
    ? [elevationProfile[hoverIndex].lat, elevationProfile[hoverIndex].lng] as [number, number]
    : null;

  // Divide a trilha em segmentos: percorrido (vermelho) e à frente (verde)
  const walkedCoords = isTracking ? (coordinates.slice(0, walkedIndex + 1) as [number, number][]) : [];
  const aheadCoords = isTracking ? (coordinates.slice(walkedIndex) as [number, number][]) : (coordinates as [number, number][]);

  return (
    <div className="w-full h-full bg-gray-900 relative z-0">
      <MapContainer 
        center={[startPoint[0], startPoint[1]]} 
        zoom={14} 
        zoomControl={false}
        className="w-full h-full"
      >
        <ResizeHandler />
        {/* Controla o mapa quando o GPS está rastreando */}
        {isTracking && trackingPos && (
          <MapController center={[trackingPos.lat, trackingPos.lng]} zoom={16} centerRequest={centerRequest} />
        )}

        {/* Camada de Tile controlada por layerMode */}
        {layerMode === "satellite" ? (
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        ) : (
          <TileLayer
            attribution='&copy; OpenTopoMap'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        )}

        {/* Trilha: laranja normal / verde+vermelho quando rastreando */}
        {!isTracking && (
          <>
            <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#f97316', weight: 8, opacity: 0.3 }} />
            <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#f97316', weight: 4, opacity: 1, dashArray: '1, 10', lineCap: 'round', lineJoin: 'round' }} />
            <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#fb923c', weight: 2, opacity: 1 }} />
          </>
        )}
        {isTracking && walkedCoords.length > 1 && (
          <Polyline positions={walkedCoords} pathOptions={{ color: '#ef4444', weight: 6, opacity: 0.95 }} />
        )}
        {isTracking && aheadCoords.length > 1 && (
          <Polyline positions={aheadCoords} pathOptions={{ color: '#22c55e', weight: 6, opacity: 0.95, dashArray: '2, 8', lineCap: 'round' }} />
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
          <Tooltip direction="top" offset={[0, -10]} className="bg-gray-900 text-white font-bold border-none shadow-xl">Cachoeira (Fim)</Tooltip>
        </Marker>

        {/* Marcadores de POIs Flutuantes */}
        {midPoint1 && (
          <Marker position={[midPoint1[0], midPoint1[1]]} icon={viewpointIcon}>
            <Tooltip direction="top" offset={[0, -20]} className="bg-white/90 backdrop-blur font-bold border-none shadow-xl p-3 rounded-xl text-gray-800">
              <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-purple-600"/> Mirante do Vale</span>
              <p className="text-xs text-gray-500 font-normal mt-1">Passe o mouse sobre os ícones de câmera para ver fotos!</p>
            </Tooltip>
          </Marker>
        )}

        {midPoint2 && (
          <Marker position={[midPoint2[0], midPoint2[1]]} icon={waterIcon}>
            <Tooltip direction="top" offset={[0, -20]} className="bg-white/90 backdrop-blur font-bold border-none shadow-xl p-3 rounded-xl text-gray-800">
              <span className="flex items-center gap-2"><Droplets className="w-4 h-4 text-cyan-500"/> Ponto de Água Potável</span>
            </Tooltip>
          </Marker>
        )}

        {midPoint3 && (
          <Marker position={[midPoint3[0], midPoint3[1]]} icon={cameraIcon}>
            <Tooltip direction="top" offset={[0, -20]} className="bg-white/90 backdrop-blur font-bold border-none shadow-xl p-3 rounded-xl text-gray-800">
               <span className="flex items-center gap-2"><Camera className="w-4 h-4 text-blue-600"/> Ponto de Foto Clássica</span>
               <div className="w-32 h-20 bg-gray-200 mt-2 rounded-lg overflow-hidden">
                 {/* Placeholder for photo preview */}
                 <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/paisagem/IMG_0220.JPG" alt="Preview" className="w-full h-full object-cover" />
               </div>
            </Tooltip>
          </Marker>
        )}

        {/* Cursor do Gráfico de Elevação */}
        {cursorPoint && (
          <Marker position={cursorPoint} icon={cursorIcon} zIndexOffset={1000} />
        )}
      </MapContainer>
    </div>
  );
}
