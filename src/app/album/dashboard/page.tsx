"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Camera, LogOut, Download, Sparkles, Filter, CheckCircle2, AlertCircle, Play, X, House, Images, Square, CheckSquare, CalendarDays, Maximize2, ChevronDown, ChevronUp } from "lucide-react";
import { SlideshowViewer } from "@/components/album/SlideshowViewer";
import Webcam from "react-webcam";

type AlbumStats = {
  total: number;
  publicMedia: number;
  searchablePhotos: number;
  landscapes: number;
  groups: number;
  privatePortraits: number;
  videos: number;
};

const EMPTY_STATS: AlbumStats = { total: 0, publicMedia: 0, searchablePhotos: 0, landscapes: 0, groups: 0, privatePortraits: 0, videos: 0 };
const INITIAL_MEDIA_COUNT = 16;

export default function AlbumDashboard() {
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id: string; aws_url: string; type: "image" | "video" }[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [downloadingAlbum, setDownloadingAlbum] = useState(false);
  const [pageError, setPageError] = useState("");
  const [isFaceSearchMode, setIsFaceSearchMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [albumStats, setAlbumStats] = useState<AlbumStats>(EMPTY_STATS);
  const [visibleMediaCount, setVisibleMediaCount] = useState(INITIAL_MEDIA_COUNT);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanResult, setScanResult] = useState<{success: boolean; message: string} | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const webcamRef = useRef<Webcam>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Slideshow
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  const activeTour = tours.find((tour) => tour.id === selectedTour) || null;
  const visiblePhotos = photos.slice(0, visibleMediaCount);

  useEffect(() => {
    fetchTours();
  }, []);

  useEffect(() => {
    if (!scanning) {
      setScanStep(0);
      return;
    }
    const timer = window.setInterval(() => setScanStep((current) => Math.min(current + 1, 2)), 800);
    return () => window.clearInterval(timer);
  }, [scanning]);

  const fetchTours = async () => {
    try {
      const res = await fetch('/api/album/tours');
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        router.push('/album');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar seus álbuns');
      setTours(data.tours || []);
      if (data.tours?.length > 0) {
        handleSelectTour(data.tours[0].id);
      }
    } catch (e) {
      console.error(e);
      setPageError(e instanceof Error ? e.message : 'Não foi possível carregar seus álbuns');
    } finally {
      setLoadingTours(false);
    }
  };

  const handleSelectTour = async (agendaId: string) => {
    setSelectedTour(agendaId);
    setLoadingPhotos(true);
    setIsFaceSearchMode(false);
    setSelectionMode(false);
    setSelectedPhotoIds(new Set());
    setScanResult(null);
    setPageError("");
    setAlbumStats(EMPTY_STATS);
    setVisibleMediaCount(INITIAL_MEDIA_COUNT);
    try {
      const res = await fetch(`/api/album/${agendaId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir o álbum');
      setPhotos((data.photos || []).map((photo: any, index: number) => ({
        id: String(photo.id || `media-${index}`),
        aws_url: String(photo.aws_url || ""),
        type: photo.type === "video" ? "video" : "image",
      })));
      setAlbumStats({ ...EMPTY_STATS, ...(data.stats || {}) });
    } catch (e) {
      console.error(e);
      setPhotos([]);
      setPageError(e instanceof Error ? e.message : 'Não foi possível abrir o álbum');
    } finally {
      setLoadingPhotos(false);
    }
  };

  const captureAndSearch = async () => {
    if (!webcamRef.current || !selectedTour) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setScanResult({ success: false, message: "A câmera ainda não está pronta. Use a opção de selfie abaixo." });
      return;
    }

    await searchFaceImage(imageSrc);
  };

  const searchFaceImage = async (imageSrc: string) => {
    if (!selectedTour) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/ai/find-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendaId: selectedTour, imageBase64: imageSrc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível analisar a selfie');
      
      if (data.matches && data.matches.length > 0) {
        setPhotos(data.matches.map((match: string | { id?: string; url?: string; type?: string }, index: number) => ({
          id: `face-result-${index}`,
          aws_url: typeof match === "string" ? match : String(match.url || ""),
          type: typeof match !== "string" && match.type === "video" ? "video" : "image",
        })));
        setIsFaceSearchMode(true);
        setVisibleMediaCount(INITIAL_MEDIA_COUNT);
        setSelectionMode(false);
        setSelectedPhotoIds(new Set());
        const bestSimilarity = typeof data.matches[0] === "object" ? Number(data.matches[0]?.similarity || 0) : 0;
        setScanResult({ success: true, message: `Encontramos ${data.matches.length} foto(s)${bestSimilarity ? ` · melhor correspondência ${bestSimilarity.toFixed(0)}%` : ""}.` });
        setTimeout(() => setShowScanner(false), 2000);
      } else {
        setScanResult({ success: false, message: 'Nenhum rosto encontrado nesta trilha.' });
      }
    } catch (error) {
      setScanResult({ success: false, message: error instanceof Error ? error.message : 'Erro ao buscar rosto.' });
    } finally {
      setScanning(false);
    }
  };

  const handleSelfieFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10_000_000) {
      setScanResult({ success: false, message: "Escolha uma selfie válida de até 10 MB." });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") void searchFaceImage(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/album');
  };

  const handleBulkDownload = async (photoIds?: string[]) => {
    if (!selectedTour || downloadingAlbum) return;
    setDownloadingAlbum(true);
    try {
      const response = await fetch(`/api/album/${selectedTour}/download`, photoIds?.length ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds }),
      } : { cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Não foi possível baixar o álbum');
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${safeFilename(activeTour?.album_title || 'album-mais-trilha')}.zip`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível baixar o álbum');
    } finally {
      setDownloadingAlbum(false);
    }
  };

  const downloadPhoto = async (photo: { id: string; aws_url: string; type: "image" | "video" }, index: number) => {
    setDownloadingPhotoId(photo.id);
    try {
      const response = await fetch(photo.aws_url);
      if (!response.ok) throw new Error('Falha ao baixar');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `mais-trilha-${photo.type === 'video' ? 'video' : 'foto'}-${String(index + 1).padStart(3, '0')}.${extensionFromType(blob.type, photo.type)}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(photo.aws_url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const toggleSelection = (photoId: string) => {
    setSelectedPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPhotoIds((current) => current.size === photos.length
      ? new Set()
      : new Set(photos.map((photo) => photo.id)));
  };

  const openScanner = () => {
    setScanResult(null);
    setCameraReady(false);
    setCameraError("");
    setShowScanner(true);
  };

  if (loadingTours) {
    return <div className="min-h-screen bg-[#0F1722] flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#F17B37] animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans flex flex-col relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#F17B37] rounded-full blur-[200px] opacity-10 pointer-events-none" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0F1722]/90 px-3 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-tr from-[#F17B37] to-orange-400 p-[2px] rounded-full">
            <div className="w-full h-full bg-[#0F1722] rounded-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#F17B37]" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight sm:text-base">Álbuns</h1>
            <p className="max-w-[48vw] truncate text-[9px] font-bold text-white/45 sm:max-w-sm">{activeTour?.album_title || activeTour?.title || "Escolha uma trilha"}</p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Voltar ao site">
            <House className="w-5 h-5" />
          </button>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 p-3 md:p-6">
        {pageError && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            <span>{pageError}</span>
            <button type="button" onClick={() => setPageError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
          </div>
        )}
        
        {tours.length > 0 && (
          <section className="mb-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">Escolha a trilha</p>
              <span className="text-[9px] font-bold text-white/40">Deslize para ver mais →</span>
            </div>
            <div className="-mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {tours.map((tour) => {
                const active = tour.id === selectedTour;
                return (
                  <button
                    key={tour.id}
                    type="button"
                    onClick={() => void handleSelectTour(tour.id)}
                    className={`relative h-[4.75rem] w-[68vw] max-w-64 shrink-0 snap-start overflow-hidden rounded-2xl border p-3 text-left transition ${active ? "border-orange-300 bg-orange-300/10 ring-2 ring-orange-300/20" : "border-white/10 bg-white/[0.04]"}`}
                  >
                    {tour.cover_url ? <img src={tour.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" /> : null}
                    <span className="absolute inset-0 bg-gradient-to-r from-[#071829] via-[#071829]/90 to-[#071829]/55" />
                    <span className="relative block">
                      <span className="block truncate text-sm font-black text-white">{tour.album_title || tour.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-[9px] font-bold text-white/55">
                        <span>{formatAlbumDate(tour.date)}</span>
                        <span>•</span>
                        <span>{tour.public_media_count} mídias</span>
                        {tour.face_search_available ? <Sparkles className="h-3 w-3 text-purple-300" /> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeTour && (
          <motion.section
            key={activeTour.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#071829,#173E63)] p-3 shadow-xl"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">
              {activeTour.cover_url ? <img src={activeTour.cover_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Images className="h-5 w-5 text-orange-300" /></span>}
            </div>
            <div className="relative min-w-0 flex-1">
              <h2 className="truncate text-sm font-black">{activeTour.album_title || activeTour.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold text-blue-100/60">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-orange-300" /> {formatAlbumDate(activeTour.date)}</span>
                <span>{albumStats.publicMedia} gerais</span>
                {albumStats.searchablePhotos > 0 ? <span className="flex items-center gap-1 text-purple-200"><Sparkles className="h-3 w-3" /> IA</span> : null}
              </div>
            </div>
            <button onClick={() => setSlideshowIndex(0)} disabled={!photos.length} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#071829] shadow-lg disabled:opacity-40" aria-label="Assistir apresentação">
              <Play className="h-4 w-4 fill-current" />
            </button>
          </motion.section>
        )}

        <div className="sticky top-[3.65rem] z-30 mb-3 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#111d2a]/95 p-2.5 shadow-xl backdrop-blur-xl">
          <div className="min-w-0 pl-1">
            <h3 className="truncate text-sm font-black">{isFaceSearchMode ? 'Suas fotos' : 'Galeria geral'}</h3>
            <p className="text-[9px] font-bold text-gray-400">{selectionMode ? `${selectedPhotoIds.size} selecionada(s)` : `${photos.length} mídia(s)`}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isFaceSearchMode ? (
              <button onClick={() => handleSelectTour(selectedTour!)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black hover:bg-white/10"><Filter className="h-3.5 w-3.5" /> Geral</button>
            ) : photos.length ? (
              <button onClick={() => { setSelectionMode((current) => !current); setSelectedPhotoIds(new Set()); }} className={`grid h-10 w-10 place-items-center rounded-xl border ${selectionMode ? 'border-orange-300 bg-orange-300/10 text-orange-200' : 'border-white/10 bg-white/5'}`} aria-label="Selecionar fotos">{selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button>
            ) : null}
            {!isFaceSearchMode ? <button onClick={openScanner} disabled={!selectedTour || albumStats.searchablePhotos === 0} title={albumStats.searchablePhotos === 0 ? 'Este álbum ainda não possui retratos indexados' : undefined} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3 text-[10px] font-black shadow-[0_0_18px_rgba(147,51,234,0.25)] disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" /> Me encontrar</button> : null}
            {selectionMode ? <button onClick={selectAll} className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black">{selectedPhotoIds.size === photos.length ? 'Limpar' : 'Todas'}</button> : null}
            {photos.length && !isFaceSearchMode ? <button onClick={() => void handleBulkDownload(selectionMode ? Array.from(selectedPhotoIds) : undefined)} disabled={downloadingAlbum || (selectionMode && !selectedPhotoIds.size)} className="grid h-10 w-10 place-items-center rounded-xl bg-[#F17B37] text-white shadow-[0_0_18px_rgba(241,123,55,0.25)] disabled:opacity-50" aria-label={selectionMode ? 'Baixar seleção' : 'Baixar galeria'}>{downloadingAlbum ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button> : null}
          </div>
        </div>

        {/* Gallery Grid */}
        {loadingPhotos ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#F17B37]" />
            <p className="font-bold">Carregando memórias...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-white/5 px-5 text-center text-gray-500">
            {albumStats.searchablePhotos > 0 ? <Sparkles className="mb-4 h-12 w-12 text-purple-300" /> : <Camera className="mb-4 h-12 w-12 opacity-50" />}
            <p className="text-lg font-bold text-white">
              {albumStats.searchablePhotos > 0 ? 'Seus retratos estão protegidos' : tours.length ? 'Nenhuma mídia encontrada' : 'Nenhum álbum liberado ainda'}
            </p>
            <p className="mt-1 max-w-md text-sm leading-relaxed">
              {albumStats.searchablePhotos > 0
                ? 'As fotos individuais não ficam expostas para todos. Tire uma selfie para encontrar somente as fotos em que você aparece.'
                : tours.length
                  ? 'Aguarde a equipe enviar as fotos e os vídeos desta trilha.'
                  : 'Quando a equipe publicar as mídias de uma trilha que você comprou, o álbum aparecerá aqui automaticamente.'}
            </p>
            {albumStats.searchablePhotos > 0 ? <button type="button" onClick={openScanner} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white shadow-lg"><Sparkles className="h-4 w-4" /> Encontrar minhas fotos</button> : null}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4"
          >
            {visiblePhotos.map((photo, idx) => {
              const isVideo = photo.type === 'video';
              const selected = selectedPhotoIds.has(photo.id);
              return (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.035, 0.4) }}
                  className={`relative group rounded-2xl overflow-hidden cursor-pointer break-inside-avoid bg-white/5 border transition ${selected ? 'border-orange-300 ring-4 ring-orange-300/20' : 'border-white/10'}`}
                  onClick={() => selectionMode ? toggleSelection(photo.id) : setSlideshowIndex(idx)}
                >
                  {isVideo ? (
                    <div className="aspect-[9/16] bg-gray-900 flex items-center justify-center relative">
                      <video src={photo.aws_url} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center z-10 border border-white/20">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={photo.aws_url} 
                      alt={`Foto ${idx}`} 
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  )}
                  {selectionMode ? <span className={`absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border-2 ${selected ? 'border-orange-300 bg-[#F17B37] text-white' : 'border-white bg-black/45 text-transparent'}`}><CheckCircle2 className="h-5 w-5" /></span> : null}
                  {!selectionMode ? <span className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"><Maximize2 className="h-4 w-4" /></span> : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pt-12 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/80">{isVideo ? 'Vídeo' : `Foto ${String(idx + 1).padStart(3, '0')}`}</span>
                    {!selectionMode ? <button type="button" onClick={(event) => { event.stopPropagation(); void downloadPhoto(photo, idx); }} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#071829] shadow-lg" aria-label={`Baixar ${isVideo ? 'vídeo' : 'foto'}`}>{downloadingPhotoId === photo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button> : null}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        {!loadingPhotos && photos.length > INITIAL_MEDIA_COUNT ? (
          <div className="mt-5 flex justify-center">
            {visibleMediaCount < photos.length ? (
              <button type="button" onClick={() => setVisibleMediaCount((current) => Math.min(current + INITIAL_MEDIA_COUNT, photos.length))} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-xs font-black text-white shadow-lg hover:bg-white/10">
                <ChevronDown className="h-4 w-4" /> Carregar mais {Math.min(INITIAL_MEDIA_COUNT, photos.length - visibleMediaCount)}
              </button>
            ) : (
              <button type="button" onClick={() => { setVisibleMediaCount(INITIAL_MEDIA_COUNT); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-xs font-black text-white">
                <ChevronUp className="h-4 w-4" /> Recolher galeria
              </button>
            )}
          </div>
        ) : null}
      </main>

      {/* Face Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[#020b14]/95 p-3 backdrop-blur-xl sm:items-center sm:p-4"
          >
            <motion.div initial={{ y: 32, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 32, scale: 0.98 }} className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#0F1722] shadow-2xl">
              <button 
                onClick={() => setShowScanner(false)} 
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="border-b border-white/10 bg-gradient-to-b from-purple-900/35 to-transparent px-5 py-4 text-center">
                <h3 className="text-lg font-black">Encontre suas fotos</h3>
                <p className="mt-1 text-[11px] font-medium text-gray-400">Rosto de frente · boa luz · sem óculos escuros</p>
              </div>

              <div className="relative mx-auto aspect-[4/5] max-h-[54vh] w-full overflow-hidden bg-black">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.92}
                  videoConstraints={{ facingMode: "user", width: 960, height: 1200 }}
                  onUserMedia={() => { setCameraReady(true); setCameraError(""); }}
                  onUserMediaError={() => { setCameraReady(false); setCameraError("Não foi possível abrir a câmera neste navegador."); }}
                  className="h-full w-full object-cover"
                />

                {!cameraReady && !scanning ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#071829] px-8 text-center">
                    {cameraError ? <AlertCircle className="mb-3 h-10 w-10 text-orange-300" /> : <Loader2 className="mb-3 h-9 w-9 animate-spin text-purple-300" />}
                    <p className="text-sm font-black">{cameraError || "Solicitando acesso à câmera..."}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/50">Permita o uso da câmera ou tire uma selfie usando o botão abaixo.</p>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-[12%_19%] rounded-[45%] border-2 border-white/75 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                <span className="pointer-events-none absolute left-[16%] top-[9%] h-9 w-9 rounded-tl-2xl border-l-2 border-t-2 border-orange-300" />
                <span className="pointer-events-none absolute right-[16%] top-[9%] h-9 w-9 rounded-tr-2xl border-r-2 border-t-2 border-orange-300" />
                <span className="pointer-events-none absolute bottom-[9%] left-[16%] h-9 w-9 rounded-bl-2xl border-b-2 border-l-2 border-orange-300" />
                <span className="pointer-events-none absolute bottom-[9%] right-[16%] h-9 w-9 rounded-br-2xl border-b-2 border-r-2 border-orange-300" />
                
                {scanning && (
                  <motion.div 
                    initial={{ top: '16%' }}
                    animate={{ top: '82%' }}
                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.15, ease: "easeInOut" }}
                    className="pointer-events-none absolute left-[19%] right-[19%] h-0.5 bg-gradient-to-r from-transparent via-orange-300 to-transparent shadow-[0_0_15px_rgba(253,186,116,1)]"
                  />
                )}
                
                {/* Result Overlay */}
                <AnimatePresence>
                  {scanResult && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${scanResult.success ? 'bg-emerald-950/82' : 'bg-red-950/82'}`}
                    >
                      {scanResult.success ? <CheckCircle2 className="mb-3 h-14 w-14 text-emerald-300" /> : <AlertCircle className="mb-3 h-14 w-14 text-red-300" />}
                      <p className="max-w-xs text-base font-black">{scanResult.message}</p>
                      {!scanResult.success ? <p className="mt-2 text-[11px] text-white/60">Tente novamente olhando diretamente para a câmera.</p> : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4">
                {scanning ? (
                  <div className="mb-3">
                    <p className="text-center text-xs font-black text-purple-100">{["Validando selfie", "Comparando rostos", "Organizando resultados"][scanStep]}</p>
                    <div className="mt-2 flex justify-center gap-1.5">{[0, 1, 2].map((step) => <span key={step} className={`h-1.5 rounded-full transition-all ${step <= scanStep ? "w-7 bg-purple-400" : "w-1.5 bg-white/15"}`} />)}</div>
                  </div>
                ) : null}
                <button
                  onClick={() => scanResult && !scanResult.success ? setScanResult(null) : void captureAndSearch()}
                  disabled={scanning || Boolean(scanResult?.success) || !cameraReady}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(147,51,234,0.25)] hover:bg-purple-700 disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {scanning ? "Busca inteligente em andamento" : scanResult ? "Tentar novamente" : "Tirar selfie e buscar"}
                </button>
                <input ref={selfieInputRef} type="file" accept="image/*" capture="user" onChange={handleSelfieFile} className="hidden" />
                {!scanResult?.success ? (
                  <button type="button" disabled={scanning} onClick={() => selfieInputRef.current?.click()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-white disabled:opacity-50">
                    <Camera className="h-4 w-4" /> Abrir câmera do celular
                  </button>
                ) : null}
                <p className="mt-2 text-center text-[9px] font-bold text-white/35">A selfie não é salva no álbum.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slideshow Fullscreen */}
      {slideshowIndex !== null && (
        <SlideshowViewer 
          photos={photos.map(p => ({ url: p.aws_url, type: p.type }))}
          initialIndex={slideshowIndex} 
          onClose={() => setSlideshowIndex(null)} 
          title={activeTour?.album_title || activeTour?.title || "Álbum da trilha"}
        />
      )}
    </div>
  );
}

function formatAlbumDate(value: string) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function extensionFromType(contentType: string, mediaType: "image" | "video") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mp4")) return "mp4";
  return mediaType === "video" ? "mp4" : "jpg";
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "album-mais-trilha";
}
