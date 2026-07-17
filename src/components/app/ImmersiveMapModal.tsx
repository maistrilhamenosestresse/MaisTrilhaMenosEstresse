"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Map, Compass, Navigation, Mountain, Route, Info, ChevronUp, ChevronDown, Play, Square, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import ElevationProfile from "./ElevationProfile";

const ImmersiveMap = dynamic(() => import('./ImmersiveMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-900 animate-pulse flex items-center justify-center text-gray-500 text-sm">Iniciando mapa...</div>
});

interface ImmersiveMapModalProps {
  agendaId?: string;
  trailName: string;
  onClose: () => void;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function closestPointIndex(userLat: number, userLng: number, trail: { lat: number; lng: number }[]): number {
  let minDist = Infinity;
  let idx = 0;
  trail.forEach((p, i) => {
    const d = getDistanceMeters(userLat, userLng, p.lat, p.lng);
    if (d < minDist) { minDist = d; idx = i; }
  });
  return idx;
}

export default function ImmersiveMapModal({ agendaId, trailName, onClose }: ImmersiveMapModalProps) {
  const [elevationData, setElevationData] = useState<any[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layerMode, setLayerMode] = useState<"satellite" | "topo">("satellite");

  const [tracking, setTracking] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [centerRequest, setCenterRequest] = useState(0);
  const [walkedIndex, setWalkedIndex] = useState(0);
  const [offTrailAlert, setOffTrailAlert] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxElev = elevationData.length > 0
    ? Math.round(Math.max(...elevationData.map(d => d.elevation)) - Math.min(...elevationData.map(d => d.elevation)))
    : null;
  const totalDist = elevationData.length > 0 ? elevationData[elevationData.length - 1].distance : null;

  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 350);
    return () => clearTimeout(t);
  }, [drawerOpen]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setTracking(true);
    setWalkedIndex(0);
    setOffTrailAlert(false);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading } = pos.coords;
        setUserPos({ lat, lng, heading });

        if (elevationData.length > 0) {
          const nearest = closestPointIndex(lat, lng, elevationData);
          const distToTrail = getDistanceMeters(lat, lng, elevationData[nearest].lat, elevationData[nearest].lng);
          setWalkedIndex(nearest);

          if (distToTrail > 50) {
            if (!alertTimerRef.current) {
              alertTimerRef.current = setTimeout(() => {
                setOffTrailAlert(true);
                alertTimerRef.current = null;
              }, 5000);
            }
          } else {
            if (alertTimerRef.current) { clearTimeout(alertTimerRef.current); alertTimerRef.current = null; }
            setOffTrailAlert(false);
          }
        }
      },
      (err) => console.error("Erro de geolocalização:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, [elevationData]);

  const stopTracking = useCallback(() => {
    setTracking(false);
    setOffTrailAlert(false);
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (alertTimerRef.current) { clearTimeout(alertTimerRef.current); alertTimerRef.current = null; }
  }, []);

  useEffect(() => () => { stopTracking(); }, [stopTracking]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 h-[100dvh] z-[200] bg-black overflow-hidden font-sans"
    >
      {/* MAPA 100% */}
      <div className="absolute inset-0 z-0">
        <ImmersiveMap
          agendaId={agendaId}
          onElevationData={setElevationData}
          hoverIndex={hoverIndex}
          layerMode={layerMode}
          trackingPos={userPos}
          walkedIndex={walkedIndex}
          isTracking={tracking}
          centerRequest={centerRequest}
        />
      </div>

      {/* UI FLUTUANTE */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-10 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 max-w-[55%]">
            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Trilha</p>
            <p className="text-white font-black text-sm leading-tight line-clamp-1">{trailName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-black/70 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CONTROLES DIREITA */}
        <div className="absolute right-4 top-28 flex flex-col gap-2.5 pointer-events-auto">
          <button
            onClick={() => setLayerMode(l => l === "satellite" ? "topo" : "satellite")}
            className={`w-11 h-11 backdrop-blur-md border rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all ${layerMode === "topo" ? "bg-blue-500 border-blue-400 text-white" : "bg-black/60 border-white/20 text-white"}`}
            title="Alternar Camada"
          >
            <Map className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCenterRequest(r => r + 1)}
            className="w-11 h-11 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
            title="Centralizar na minha localização"
          >
            <Compass className="w-5 h-5" />
          </button>
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className={`w-11 h-11 backdrop-blur-md border rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all ${drawerOpen ? "bg-orange-500 border-orange-400 text-white" : "bg-black/60 border-white/20 text-white"}`}
            title="Informações"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* ALERTA: FORA DA TRILHA */}
        <AnimatePresence>
          {offTrailAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm pointer-events-auto z-50"
            >
              <div className="bg-red-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <p className="font-black text-sm">Você está saindo da trilha!</p>
                  <p className="text-xs text-red-100">Retorne ao percurso marcado no mapa.</p>
                </div>
                <button onClick={() => setOffTrailAlert(false)} className="opacity-70 hover:opacity-100 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTÃO INICIAR / PARAR */}
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-auto">
          <AnimatePresence mode="wait">
            {!tracking ? (
              <motion.button
                key="start"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                onClick={startTracking}
                className="flex items-center gap-3 bg-green-500 hover:bg-green-400 active:scale-95 transition-all text-white font-black px-7 py-4 rounded-2xl shadow-2xl border border-green-400"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <span className="text-sm tracking-widest uppercase">Iniciar Trilha</span>
              </motion.button>
            ) : (
              <motion.div
                key="tracking"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur border border-green-500/50 text-white px-4 py-3 rounded-2xl shadow-xl">
                  <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs font-black tracking-wider text-green-400">RASTREANDO</span>
                </div>
                <button
                  onClick={stopTracking}
                  className="w-12 h-12 bg-red-500 hover:bg-red-400 active:scale-95 text-white rounded-2xl flex items-center justify-center shadow-xl border border-red-400"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* DRAWER DE INFORMAÇÕES */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          <motion.div
            className="bg-black/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl overflow-hidden"
            animate={{ height: drawerOpen ? "auto" : 52 }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
          >
            <button
              onClick={() => setDrawerOpen(o => !o)}
              className="w-full h-[52px] flex items-center justify-between px-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-1 bg-white/25 rounded-full" />
                <span className="text-white/60 font-bold text-sm">
                  {drawerOpen ? "Fechar informações" : "Ver informações da trilha"}
                </span>
              </div>
              {drawerOpen ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronUp className="w-5 h-5 text-white/40" />}
            </button>

            <AnimatePresence>
              {drawerOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 pb-10 space-y-4 max-h-[60vh] overflow-y-auto"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: <Route className="w-4 h-4 text-blue-400" />, label: "Tipo", value: "Trekking" },
                      { icon: <Navigation className="w-4 h-4 text-green-400" />, label: "Distância", value: totalDist ? `${totalDist} km` : "—" },
                      { icon: <Mountain className="w-4 h-4 text-orange-400" />, label: "Desnível", value: maxElev ? `${maxElev}m` : "—" },
                    ].map((s, i) => (
                      <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                        <div className="flex justify-center mb-1.5">{s.icon}</div>
                        <p className="text-[9px] text-white/50 font-bold uppercase">{s.label}</p>
                        <p className="text-xs font-black text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {tracking && (
                    <div className="bg-white/5 rounded-xl p-3 flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-2 bg-red-500 rounded-full" />
                        <span className="text-xs text-white/60">Já percorrido</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-2 bg-green-400 rounded-full" />
                        <span className="text-xs text-white/60">À frente</span>
                      </div>
                    </div>
                  )}

                  {elevationData.length > 0 && (
                    <div className="relative pt-3">
                      <div className="absolute top-1 left-4 bg-orange-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Altitude
                      </div>
                      <div className="h-[100px] rounded-xl overflow-hidden">
                        <ElevationProfile data={elevationData} onHoverIndexChange={setHoverIndex} dark />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
