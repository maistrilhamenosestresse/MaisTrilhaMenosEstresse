"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Layers3, Compass, Navigation, Mountain, Route, Info, ChevronUp, ChevronDown, Play, Square, AlertTriangle, WifiOff, Wifi, ShieldCheck, LocateFixed, Map as MapIcon, Satellite } from "lucide-react";
import dynamic from "next/dynamic";
import ElevationProfile from "./ElevationProfile";
import { useNetworkStatus } from "@/lib/app/use-network-status";
import { OfflineMapDownloadCard } from "@/components/app/OfflineMapDownloadCard";
import { getOfflineMapPack, type OfflineMapPack } from "@/lib/app/offline-trails";

const ImmersiveMap = dynamic(() => import('./ImmersiveMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-900 animate-pulse flex items-center justify-center text-gray-500 text-sm">Iniciando mapa...</div>
});

interface ImmersiveMapModalProps {
  agendaId?: string;
  trailName: string;
  onClose: () => void;
  initialDrawerOpen?: boolean;
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

export default function ImmersiveMapModal({ agendaId, trailName, onClose, initialDrawerOpen = false }: ImmersiveMapModalProps) {
  const [elevationData, setElevationData] = useState<{ distance: number; elevation: number; lat: number; lng: number }[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [layerMode, setLayerMode] = useState<"street" | "satellite" | "topo" | "offline">("topo");
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [offlineMapPack, setOfflineMapPack] = useState<OfflineMapPack | null>(null);
  const [offlineRoute, setOfflineRoute] = useState(false);
  const [usingOfflineCopy, setUsingOfflineCopy] = useState(false);

  const [tracking, setTracking] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; heading: number | null; accuracy: number } | null>(null);
  const [centerRequest, setCenterRequest] = useState(0);
  const [walkedIndex, setWalkedIndex] = useState(0);
  const [offTrailAlert, setOffTrailAlert] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [distanceFromTrail, setDistanceFromTrail] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = useNetworkStatus();

  const maxElev = elevationData.length > 0
    ? Math.round(Math.max(...elevationData.map(d => d.elevation)) - Math.min(...elevationData.map(d => d.elevation)))
    : null;
  const totalDist = elevationData.length > 0 ? elevationData[elevationData.length - 1].distance : null;
  const progress = elevationData.length > 1 ? Math.min(100, Math.round((walkedIndex / (elevationData.length - 1)) * 100)) : 0;
  const remainingDistance = totalDist !== null && elevationData[walkedIndex]
    ? Math.max(0, totalDist - elevationData[walkedIndex].distance)
    : null;
  const handleOfflineAvailability = useCallback((available: boolean, usingCopy: boolean) => {
    setOfflineRoute(available);
    setUsingOfflineCopy(usingCopy);
  }, []);

  useEffect(() => {
    if (!agendaId) return;
    void getOfflineMapPack(agendaId).then((pack) => {
      setOfflineMapPack(pack);
      if (!navigator.onLine && pack) setLayerMode("offline");
    }).catch(() => undefined);
  }, [agendaId]);

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
    setGpsError("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords;
        setUserPos({ lat, lng, heading, accuracy });

        if (elevationData.length > 0) {
          const nearest = closestPointIndex(lat, lng, elevationData);
          const distToTrail = getDistanceMeters(lat, lng, elevationData[nearest].lat, elevationData[nearest].lng);
          setDistanceFromTrail(distToTrail);
          setWalkedIndex(nearest);

          if (distToTrail > Math.max(50, accuracy * 1.5)) {
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
      (err) => {
        setTracking(false);
        setGpsError(err.code === 1 ? "Permita o acesso à localização para iniciar a navegação." : "Não foi possível obter sua localização. Verifique o GPS do aparelho.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [elevationData]);

  const stopTracking = useCallback(() => {
    setTracking(false);
    setOffTrailAlert(false);
    setDistanceFromTrail(null);
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
          onOfflineAvailabilityChange={handleOfflineAvailability}
          offlineContextGeojson={offlineMapPack?.geojson}
        />
      </div>

      {/* UI FLUTUANTE */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-10 pointer-events-auto">
          <div className="max-w-[62%] rounded-2xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Trilha</p>
            <p className="text-white font-black text-sm leading-tight line-clamp-1">{trailName}</p>
            <p className={`mt-1 flex items-center gap-1 text-[9px] font-bold ${online ? "text-emerald-300" : "text-amber-200"}`}>
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Navegação offline"}
            </p>
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
          <div className="relative">
            <AnimatePresence>
              {layerPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 10, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.96 }}
                  className="absolute right-14 top-0 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#071829]/95 p-2 text-white shadow-2xl backdrop-blur-xl"
                >
                  <p className="px-2 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Escolha o mapa</p>
                  {([
                    { value: "topo", label: "Trilha e relevo", icon: Mountain, available: true },
                    { value: "street", label: "Ruas e acessos", icon: MapIcon, available: true },
                    { value: "satellite", label: "Satélite", icon: Satellite, available: true },
                    { value: "offline", label: "Mapa baixado", icon: WifiOff, available: Boolean(offlineMapPack) },
                  ] as const).map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!option.available}
                        onClick={() => {
                          setLayerMode(option.value);
                          setLayerPickerOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${layerMode === option.value ? "bg-orange-500 text-white" : "text-white/75 hover:bg-white/10"} disabled:cursor-not-allowed disabled:opacity-35`}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setLayerPickerOpen((open) => !open)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl border text-white shadow-lg backdrop-blur-md transition-all active:scale-95 ${layerPickerOpen ? "border-orange-300 bg-orange-500" : "border-white/20 bg-black/60"}`}
              title={`Mapa atual: ${layerLabel(layerMode)}`}
            >
              <Layers3 className="h-5 w-5" />
              <span className="absolute -bottom-5 right-0 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black uppercase text-white/90">
                {layerLabel(layerMode)}
              </span>
            </button>
          </div>
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

        <AnimatePresence>
          {gpsError && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto absolute left-4 right-4 top-28 z-40 rounded-2xl border border-amber-300/30 bg-amber-500/95 p-4 text-[#071829] shadow-2xl">
              <div className="flex items-start gap-3">
                <LocateFixed className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1"><p className="text-sm font-black">GPS precisa de atenção</p><p className="mt-1 text-xs font-medium leading-relaxed">{gpsError}</p></div>
                <button onClick={() => setGpsError("")}><X className="h-4 w-4" /></button>
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
                  <span className="text-xs font-black tracking-wider text-green-400">{progress}% CONCLUÍDO</span>
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
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-emerald-400/10 p-3">
                        <p className="text-[9px] font-bold uppercase text-emerald-200/60">Progresso</p>
                        <p className="mt-1 text-sm font-black text-emerald-200">{progress}%</p>
                      </div>
                      <div className="rounded-xl bg-white/10 p-3">
                        <p className="text-[9px] font-bold uppercase text-white/45">Restante</p>
                        <p className="mt-1 text-sm font-black text-white">{remainingDistance !== null ? `${remainingDistance.toFixed(1)} km` : "—"}</p>
                      </div>
                      <div className="rounded-xl bg-white/10 p-3">
                        <p className="text-[9px] font-bold uppercase text-white/45">Precisão</p>
                        <p className="mt-1 text-sm font-black text-white">{userPos ? `±${Math.round(userPos.accuracy)} m` : "—"}</p>
                      </div>
                    </div>
                  )}

                  {tracking && distanceFromTrail !== null && (
                    <div className={`flex items-center gap-3 rounded-xl border p-3 ${offTrailAlert ? "border-red-400/30 bg-red-400/10" : "border-emerald-400/20 bg-emerald-400/10"}`}>
                      <ShieldCheck className={`h-5 w-5 ${offTrailAlert ? "text-red-300" : "text-emerald-300"}`} />
                      <div>
                        <p className="text-xs font-black text-white">{offTrailAlert ? "Fora do percurso" : "Você está no percurso"}</p>
                        <p className="text-[10px] text-white/55">Distância da linha: {Math.round(distanceFromTrail)} m</p>
                      </div>
                    </div>
                  )}

                  {agendaId ? (
                    <OfflineMapDownloadCard
                      agendaId={agendaId}
                      title={trailName}
                      compact
                      onPackChange={(pack) => {
                        setOfflineMapPack(pack);
                        if (pack) setLayerMode("offline");
                        else setLayerMode("street");
                      }}
                    />
                  ) : null}

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

                  {offlineRoute && (
                    <div className="flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3">
                      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <div>
                        <p className="text-xs font-black text-cyan-100">
                          {usingOfflineCopy ? "Usando rota salva no aparelho" : "Rota GPS salva neste aparelho"}
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-cyan-100/60">
                          {offlineMapPack
                            ? "Mapa vetorial, rota, sua posição e alertas estão prontos para funcionar sem internet."
                            : "A linha, sua posição e os alertas funcionam sem internet. Baixe o mapa para ter também caminhos, água, vegetação e pontos de apoio."}
                        </p>
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

function layerLabel(layer: "street" | "satellite" | "topo" | "offline") {
  if (layer === "street") return "Ruas";
  if (layer === "satellite") return "Satélite";
  if (layer === "topo") return "Trilha";
  return "Offline";
}
