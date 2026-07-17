"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, MapPin, Play, Square, Navigation, Crosshair, Map as MapIcon } from "lucide-react";

// Ícones HTML customizados
const startIcon = L.divIcon({
  html: `<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const endIcon = L.divIcon({
  html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 2px; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Ícone direcional do usuário
const createUserIcon = (heading: number | null) => L.divIcon({
  html: `<div style="transform: rotate(${heading || 0}deg); transition: transform 0.2s ease-out; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 4L26 28L18 24L10 28L18 4Z" fill="#3b82f6" stroke="white" stroke-width="2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.4))"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Calcula a distância entre dois pontos (Fórmula de Haversine) em km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function MapController({ center, zoom }: { center: [number, number] | null, zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }
  }, [center, map, zoom]);
  return null;
}

interface GpsMapProps {
  agendaId?: string;
  onElevationData?: (data: { distance: number, elevation: number }[]) => void;
}

export default function GpsMap({ agendaId, onElevationData }: GpsMapProps) {
  const [mounted, setMounted] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number, number?][]>([]);
  const [loading, setLoading] = useState(true);
  
  // GPS Tracking States
  const [isTracking, setIsTracking] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [recordedPath, setRecordedPath] = useState<[number, number][]>([]);
  const [focusUser, setFocusUser] = useState(false);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    async function fetchGpxData() {
      if (!agendaId) return setLoading(false);
      try {
        const { data, error } = await supabase.from('trilha_gpx').select('geojson').eq('agenda_id', agendaId).single();
        if (error || !data?.geojson) return setLoading(false);

        let rawCoordinates: number[][] | null = null;
        if (Array.isArray(data.geojson.coordinates)) rawCoordinates = data.geojson.coordinates;
        else if (data.geojson.type === "FeatureCollection" && data.geojson.features?.[0]?.geometry?.coordinates) rawCoordinates = data.geojson.features[0].geometry.coordinates;
        else if (data.geojson.type === "Feature" && data.geojson.geometry?.coordinates) rawCoordinates = data.geojson.geometry.coordinates;

        if (rawCoordinates && Array.isArray(rawCoordinates)) {
          // GeoJSON usa [longitude, latitude, altitude?]
          const leafletCoords = rawCoordinates.map(c => [c[1], c[0], c[2] || 0] as [number, number, number?]);
          setCoordinates(leafletCoords);

          // Gerar perfil de elevação
          if (onElevationData && leafletCoords.length > 0) {
            let totalDistance = 0;
            const elevationProfile = leafletCoords.map((coord, i) => {
              if (i > 0) {
                const prev = leafletCoords[i-1];
                totalDistance += getDistanceFromLatLonInKm(prev[0], prev[1], coord[0], coord[1]);
              }
              return { distance: parseFloat(totalDistance.toFixed(2)), elevation: coord[2] || 0 };
            });
            onElevationData(elevationProfile);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchGpxData();
  }, [agendaId, onElevationData]);

  // Giroscópio / Bússola
  useEffect(() => {
    const handleOrientation = (e: any) => {
      let heading = null;
      if (e.webkitCompassHeading) {
        heading = e.webkitCompassHeading; // iOS
      } else if (e.alpha !== null) {
        heading = 360 - e.alpha; // Android approximations
      }
      if (heading !== null) setUserHeading(heading);
    };

    if (isTracking && typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isTracking]);

  const toggleTracking = async () => {
    if (isTracking) {
      // Stop tracking
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      setIsTracking(false);
      setFocusUser(false);
    } else {
      // Start tracking
      if (!navigator.geolocation) return alert("Seu dispositivo não suporta GPS.");
      
      // Pedir permissão de giroscópio no iOS 13+
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') alert("Permissão de bússola negada.");
        } catch (e) { console.log(e); }
      }

      setIsTracking(true);
      setFocusUser(true);
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, heading } = pos.coords;
          const newPos: [number, number] = [latitude, longitude];
          setUserPos(newPos);
          if (heading !== null && !Number.isNaN(heading)) setUserHeading(heading);
          setRecordedPath(prev => [...prev, newPos]);
        },
        (err) => alert("Erro ao acessar GPS: " + err.message),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  };

  if (!mounted || loading) return <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center animate-pulse text-gray-400"><MapIcon className="w-8 h-8" /></div>;
  if (coordinates.length === 0) return <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center rounded-2xl border border-gray-200"><AlertTriangle className="w-8 h-8 text-orange-400 mb-2" /><p className="font-bold text-gray-700">Rota indisponível</p></div>;

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  
  const mapCenter = focusUser && userPos ? userPos : [startPoint[0], startPoint[1]] as [number, number];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative z-0">
      
      {/* Action Buttons overlay */}
      <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-3">
        <button 
          onClick={() => setFocusUser(true)}
          className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-blue-600 focus:outline-none"
        >
          <Crosshair className="w-6 h-6" />
        </button>
        <button 
          onClick={toggleTracking}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white focus:outline-none ${isTracking ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isTracking ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
        </button>
      </div>

      {isTracking && (
        <div className="absolute top-4 left-4 right-4 z-[400] bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-md border border-gray-100 flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-sm font-bold text-gray-800">Gravando sua rota ao vivo...</span>
        </div>
      )}

      <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={false} className="w-full h-full min-h-[400px]">
        {focusUser && <MapController center={mapCenter} zoom={16} />}
        
        {/* OpenTopoMap (Relevo e Montanhas) */}
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />
        
        {/* Rota Original do Guia */}
        <Polyline positions={coordinates as [number, number][]} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.7, dashArray: '10, 10' }} />
        
        {/* Rota Gravada pelo Usuário */}
        {recordedPath.length > 1 && (
          <Polyline positions={recordedPath} pathOptions={{ color: '#ef4444', weight: 4, opacity: 0.9 }} />
        )}

        <Marker position={[startPoint[0], startPoint[1]]} icon={startIcon}>
          <Popup><strong>Início da Trilha</strong></Popup>
        </Marker>

        <Marker position={[endPoint[0], endPoint[1]]} icon={endIcon}>
          <Popup><strong>Ponto Final</strong></Popup>
        </Marker>

        {/* Marcador do Usuário com Bússola */}
        {userPos && (
          <Marker position={userPos} icon={createUserIcon(userHeading)} zIndexOffset={1000}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
