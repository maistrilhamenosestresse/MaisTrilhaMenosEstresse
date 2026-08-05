"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Camera, LogOut, Download, Filter, CheckCircle2, AlertCircle, Play, X, House, Images, Square, CheckSquare, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { SlideshowViewer } from "@/components/album/SlideshowViewer";
import { HorizontalMediaCarousel } from "@/components/album/HorizontalMediaCarousel";
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
  const [photos, setPhotos] = useState<{ id: string; aws_url: string; download_url?: string; type: "image" | "video" }[]>([]);
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
        download_url: String(photo.download_url || photo.aws_url || ""),
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
        setPhotos(data.matches.map((match: string | { id?: string; url?: string; download_url?: string; type?: string }, index: number) => ({
          id: typeof match === "string" ? `face-result-${index}` : String(match.id || `face-result-${index}`),
          aws_url: typeof match === "string" ? match : String(match.url || ""),
          download_url: typeof match === "string" ? match : String(match.download_url || match.url || ""),
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

  const downloadPhoto = async (photo: { id: string; aws_url: string; download_url?: string; type: "image" | "video" }, index: number) => {
    setDownloadingPhotoId(photo.id);
    try {
      const response = await fetch(photo.download_url || photo.aws_url);
      if (!response.ok) throw new Error('Falha ao baixar');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `mais-trilha-${photo.type === 'video' ? 'video' : 'foto'}-${String(index + 1).padStart(3, '0')}.${extensionFromType(blob.type, photo.type)}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(photo.download_url || photo.aws_url, '_blank', 'noopener,noreferrer');
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
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F2ED]"><Loader2 className="h-9 w-9 animate-spin text-[#D96224]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F2ED] font-sans text-[#10243A]">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white to-transparent" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-black/5 bg-[#F4F2ED]/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#10243A] p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-full">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#D96224]">Mais Trilha</p>
            <h1 className="max-w-[48vw] truncate text-sm font-black tracking-tight sm:max-w-sm sm:text-base">Álbuns da trilha</h1>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button onClick={() => router.push('/')} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white hover:text-[#10243A]" aria-label="Voltar ao site">
            <House className="w-5 h-5" />
          </button>
          <button onClick={logout} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white hover:text-red-600">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {pageError && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            <span>{pageError}</span>
            <button type="button" onClick={() => setPageError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
          </div>
        )}
        
        {tours.length > 0 && (
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D96224]">Escolha a trilha</p>
              <span className="text-[9px] font-bold text-slate-400">Deslize para ver mais →</span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {tours.map((tour) => {
                const active = tour.id === selectedTour;
                return (
                  <button
                    key={tour.id}
                    type="button"
                    onClick={() => void handleSelectTour(tour.id)}
                    className={`relative h-[5rem] w-[76vw] max-w-[19rem] shrink-0 snap-start overflow-hidden rounded-2xl border bg-white p-3 text-left shadow-sm transition ${active ? "border-[#D96224] ring-2 ring-orange-100" : "border-black/5 hover:border-slate-200"}`}
                  >
                    {tour.cover_url ? <img src={tour.cover_url} alt="" className="absolute inset-y-2 left-2 h-[calc(100%-1rem)] w-16 rounded-xl object-cover" /> : null}
                    <span className="absolute inset-y-0 left-[4.75rem] right-0 bg-white" />
                    <span className="relative ml-[4.5rem] block min-w-0">
                      <span className="block truncate text-sm font-black text-[#10243A]">{tour.album_title || tour.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-[9px] font-bold text-slate-400">
                        <span>{formatAlbumDate(tour.date)}</span>
                        <span>•</span>
                        <span>{tour.public_media_count} mídias</span>
                        {tour.face_search_available ? <Camera className="h-3 w-3 text-[#D96224]" /> : null}
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
            className="relative mb-4 flex min-h-44 items-end gap-3 overflow-hidden rounded-[1.75rem] bg-[#10243A] p-5 text-white shadow-[0_18px_50px_rgba(16,36,58,0.18)] sm:min-h-64 sm:p-7"
          >
            {activeTour.cover_url ? <img src={activeTour.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <span className="absolute inset-0 bg-gradient-to-t from-[#071829] via-[#071829]/60 to-transparent" />
            <div className="relative min-w-0 flex-1">
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{activeTour.album_title || activeTour.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-white/65">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-orange-300" /> {formatAlbumDate(activeTour.date)}</span>
                <span>{albumStats.publicMedia} gerais</span>
                {albumStats.searchablePhotos > 0 ? <span className="flex items-center gap-1 text-orange-200"><Camera className="h-3 w-3" /> busca por selfie</span> : null}
              </div>
            </div>
            <button onClick={() => setSlideshowIndex(0)} disabled={!photos.length} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#071829] shadow-lg disabled:opacity-40" aria-label="Assistir apresentação">
              <Play className="h-4 w-4 fill-current" />
            </button>
          </motion.section>
        )}

        <div className="sticky top-[4.5rem] z-30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-[0_10px_30px_rgba(16,36,58,0.08)] backdrop-blur-xl">
          <div className="min-w-0 pl-1">
            <h3 className="truncate text-sm font-black">{isFaceSearchMode ? 'Suas fotos' : 'Galeria geral'}</h3>
            <p className="text-[9px] font-bold text-slate-400">{selectionMode ? `${selectedPhotoIds.size} selecionada(s)` : `${photos.length} mídia(s)`}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            {isFaceSearchMode ? (
              <button onClick={() => handleSelectTour(selectedTour!)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black"><Filter className="h-3.5 w-3.5" /> Ver todas</button>
            ) : photos.length ? (
              <button onClick={() => { setSelectionMode((current) => !current); setSelectedPhotoIds(new Set()); }} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-black ${selectionMode ? 'border-[#D96224] bg-orange-50 text-[#B94D18]' : 'border-slate-200 bg-white'}`} aria-label="Selecionar fotos">{selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Selecionar</button>
            ) : null}
            {!isFaceSearchMode ? <button onClick={openScanner} disabled={!selectedTour || albumStats.searchablePhotos === 0} title={albumStats.searchablePhotos === 0 ? 'Este álbum ainda não possui retratos indexados' : undefined} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#D96224] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Camera className="h-3.5 w-3.5" /> Minhas fotos</button> : null}
            {selectionMode ? <button onClick={selectAll} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black">{selectedPhotoIds.size === photos.length ? 'Limpar' : 'Todas'}</button> : null}
            {photos.length && !isFaceSearchMode ? <button onClick={() => void handleBulkDownload(selectionMode ? Array.from(selectedPhotoIds) : undefined)} disabled={downloadingAlbum || (selectionMode && !selectedPhotoIds.size)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#10243A] px-3 text-[10px] font-black text-white disabled:opacity-50" aria-label={selectionMode ? 'Baixar seleção' : 'Baixar galeria'}>{downloadingAlbum ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar</button> : null}
          </div>
        </div>

        {/* Gallery Grid */}
        {loadingPhotos ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#F17B37]" />
            <p className="font-bold">Carregando memórias...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] border border-black/5 bg-white px-6 text-center text-slate-500 shadow-sm">
            <Camera className="mb-4 h-10 w-10 text-[#D96224]" />
            <p className="text-lg font-black text-[#10243A]">
              {albumStats.searchablePhotos > 0 ? 'Seus retratos estão protegidos' : tours.length ? 'Nenhuma mídia encontrada' : 'Nenhum álbum liberado ainda'}
            </p>
            <p className="mt-1 max-w-md text-sm leading-relaxed">
              {albumStats.searchablePhotos > 0
                ? 'As fotos individuais não ficam expostas para todos. Tire uma selfie para encontrar somente as fotos em que você aparece.'
                : tours.length
                  ? 'Aguarde a equipe enviar as fotos e os vídeos desta trilha.'
                  : 'Quando a equipe publicar as mídias de uma trilha que você comprou, o álbum aparecerá aqui automaticamente.'}
            </p>
            {albumStats.searchablePhotos > 0 ? <button type="button" onClick={openScanner} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D96224] px-5 text-sm font-black text-white"><Camera className="h-4 w-4" /> Encontrar minhas fotos</button> : null}
          </div>
        ) : selectionMode ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {visiblePhotos.map((photo, idx) => {
              const selected = selectedPhotoIds.has(photo.id);
              return <button key={photo.id} type="button" onClick={() => toggleSelection(photo.id)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 ${selected ? "border-[#D96224] ring-2 ring-orange-200" : "border-white"}`}>{photo.type === "video" ? <video src={photo.aws_url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={photo.aws_url} alt={`Foto ${idx + 1}`} loading="lazy" className="h-full w-full object-cover" />}<span className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full ${selected ? "bg-[#D96224] text-white" : "border-2 border-white bg-black/35 text-transparent"}`}><CheckCircle2 className="h-4 w-4" /></span></button>;
            })}
          </div>
        ) : (
          <HorizontalMediaCarousel
            items={visiblePhotos.map((photo, index) => ({ id: photo.id, url: photo.aws_url, type: photo.type, label: photo.type === "video" ? `Vídeo ${index + 1}` : `Foto ${index + 1}` }))}
            tone="light"
            onExpand={(_item, index) => setSlideshowIndex(index)}
            onDownload={(item, index) => void downloadPhoto(visiblePhotos[index] || { id: item.id, aws_url: item.url, type: item.type }, index)}
            downloadingId={downloadingPhotoId}
          />
        )}
        {!loadingPhotos && photos.length > INITIAL_MEDIA_COUNT ? (
          <div className="mt-5 flex justify-center">
            {visibleMediaCount < photos.length ? (
              <button type="button" onClick={() => setVisibleMediaCount((current) => Math.min(current + INITIAL_MEDIA_COUNT, photos.length))} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black text-[#10243A] shadow-sm">
                <ChevronDown className="h-4 w-4" /> Carregar mais {Math.min(INITIAL_MEDIA_COUNT, photos.length - visibleMediaCount)}
              </button>
            ) : (
              <button type="button" onClick={() => { setVisibleMediaCount(INITIAL_MEDIA_COUNT); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black text-[#10243A]">
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
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[#10243A]/75 p-3 backdrop-blur-md sm:items-center sm:p-4"
          >
            <motion.div initial={{ y: 32, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 32, scale: 0.98 }} className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[#F8F6F1] text-[#10243A] shadow-2xl">
              <button 
                onClick={() => setShowScanner(false)} 
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 shadow-sm"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="border-b border-black/5 bg-white px-5 py-4 text-center">
                <h3 className="text-lg font-black">Encontre suas fotos</h3>
                <p className="mt-1 text-[11px] font-medium text-slate-500">Rosto de frente · boa luz · sem óculos escuros</p>
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
                    {cameraError ? <AlertCircle className="mb-3 h-10 w-10 text-orange-300" /> : <Loader2 className="mb-3 h-9 w-9 animate-spin text-orange-300" />}
                    <p className="text-sm font-black">{cameraError || "Solicitando acesso à câmera..."}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/50">Permita o uso da câmera ou tire uma selfie usando o botão abaixo.</p>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-[12%_19%] rounded-[45%] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.24)]" />
                
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
                    <p className="text-center text-xs font-black text-[#10243A]">{["Validando selfie", "Comparando rostos", "Organizando resultados"][scanStep]}</p>
                    <div className="mt-2 flex justify-center gap-1.5">{[0, 1, 2].map((step) => <span key={step} className={`h-1.5 rounded-full transition-all ${step <= scanStep ? "w-7 bg-[#D96224]" : "w-1.5 bg-slate-200"}`} />)}</div>
                  </div>
                ) : null}
                <button
                  onClick={() => scanResult && !scanResult.success ? setScanResult(null) : void captureAndSearch()}
                  disabled={scanning || Boolean(scanResult?.success) || !cameraReady}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D96224] px-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {scanning ? "Procurando suas fotos" : scanResult ? "Tentar novamente" : "Tirar selfie e buscar"}
                </button>
                <input ref={selfieInputRef} type="file" accept="image/*" capture="user" onChange={handleSelfieFile} className="hidden" />
                {!scanResult?.success ? (
                  <button type="button" disabled={scanning} onClick={() => selfieInputRef.current?.click()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-[#10243A] disabled:opacity-50">
                    <Camera className="h-4 w-4" /> Abrir câmera do celular
                  </button>
                ) : null}
                <p className="mt-2 text-center text-[9px] font-bold text-slate-400">A selfie não é salva no álbum.</p>
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
