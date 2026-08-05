"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Camera, LogOut, Download, Sparkles, Filter, CheckCircle2, AlertCircle, Play, X, House, Images, Square, CheckSquare, CalendarDays } from "lucide-react";
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
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean; message: string} | null>(null);
  const webcamRef = useRef<Webcam>(null);

  // Slideshow
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  const activeTour = tours.find((tour) => tour.id === selectedTour) || null;

  useEffect(() => {
    fetchTours();
  }, []);

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
    if (!imageSrc) return;

    setScanning(true);
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
        setSelectionMode(false);
        setSelectedPhotoIds(new Set());
        setScanResult({ success: true, message: `Encontramos ${data.matches.length} fotos suas!` });
        setTimeout(() => setShowScanner(false), 2000);
      } else {
        setScanResult({ success: false, message: 'Nenhum rosto encontrado nesta trilha.' });
      }
    } catch {
      setScanResult({ success: false, message: 'Erro ao buscar rosto.' });
    } finally {
      setScanning(false);
    }
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
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0F1722]/80 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#F17B37] to-orange-400 p-[2px] rounded-full">
            <div className="w-full h-full bg-[#0F1722] rounded-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#F17B37]" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-tight hidden sm:block">Álbuns VIP</h1>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Voltar ao site">
            <House className="w-5 h-5" />
          </button>
          <select 
            value={selectedTour || ''} 
            onChange={(e) => handleSelectTour(e.target.value)}
            aria-label="Selecionar álbum"
            className="min-w-0 max-w-[52vw] truncate rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#F17B37] sm:max-w-xs sm:px-4 sm:text-sm"
          >
            {tours.length === 0 && <option value="">Nenhuma trilha encontrada</option>}
            {tours.map(t => (
              <option key={t.id} value={t.id} className="bg-[#0F1722]">{t.album_title || t.title}</option>
            ))}
          </select>

          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 relative z-10 max-w-7xl mx-auto w-full">
        {pageError && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            <span>{pageError}</span>
            <button type="button" onClick={() => setPageError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
          </div>
        )}
        
        {tours.length > 0 && (
          <section className="mb-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Álbuns disponíveis</p>
                <h2 className="mt-1 text-lg font-black">Suas trilhas com fotos</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/70">{tours.length} {tours.length === 1 ? "trilha" : "trilhas"}</span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {tours.map((tour) => {
                const active = tour.id === selectedTour;
                return (
                  <button
                    key={tour.id}
                    type="button"
                    onClick={() => void handleSelectTour(tour.id)}
                    className={`relative min-h-28 w-[78vw] max-w-72 shrink-0 snap-start overflow-hidden rounded-2xl border p-4 text-left transition ${active ? "border-orange-300 bg-orange-300/10 ring-2 ring-orange-300/20" : "border-white/10 bg-white/[0.04]"}`}
                  >
                    {tour.cover_url ? <img src={tour.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" /> : null}
                    <span className="absolute inset-0 bg-gradient-to-r from-[#071829] via-[#071829]/90 to-[#071829]/55" />
                    <span className="relative block">
                      <span className="block truncate text-sm font-black text-white">{tour.album_title || tour.title}</span>
                      <span className="mt-1 block text-[10px] font-bold text-white/55">{formatAlbumDate(tour.date)}</span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black text-white/75">{tour.public_media_count} gerais</span>
                        {tour.face_search_available ? <span className="rounded-full bg-purple-500/25 px-2 py-1 text-[9px] font-black text-purple-100">IA disponível</span> : null}
                        {tour.video_count ? <span className="rounded-full bg-blue-500/25 px-2 py-1 text-[9px] font-black text-blue-100">{tour.video_count} vídeo(s)</span> : null}
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#071829,#173E63)] shadow-2xl"
          >
            {activeTour.cover_url ? <img src={activeTour.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 blur-[1px]" /> : null}
            <div className="absolute inset-0 bg-gradient-to-r from-[#071829] via-[#071829]/90 to-[#071829]/55" />
            <div className="relative grid gap-5 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">
                  <Sparkles className="h-3 w-3" /> Memórias da sua aventura
                </span>
                <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">{activeTour.album_title || activeTour.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100/70">{activeTour.album_description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-bold text-blue-100/65">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-orange-300" /> {formatAlbumDate(activeTour.date)}</span>
                  <span className="flex items-center gap-1.5"><Images className="h-3.5 w-3.5 text-orange-300" /> {albumStats.publicMedia} arquivos gerais</span>
                  {albumStats.searchablePhotos > 0 ? <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-300" /> Reconhecimento facial disponível</span> : null}
                  <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-orange-300" /> {activeTour.photographer}</span>
                </div>
              </div>
              <button onClick={() => setSlideshowIndex(0)} disabled={!photos.length} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#071829] shadow-xl disabled:opacity-40">
                <Play className="h-4 w-4 fill-current" /> Assistir apresentação
              </button>
            </div>
          </motion.section>
        )}

        <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-black">{isFaceSearchMode ? 'Encontramos você!' : 'Paisagens, grupos e vídeos'}</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-400">
              {selectionMode
                ? `${selectedPhotoIds.size} selecionada(s)`
                : isFaceSearchMode
                  ? `${photos.length} retrato(s) localizado(s) com privacidade.`
                  : `${photos.length} arquivo(s) gerais em qualidade original, disponíveis para os participantes desta trilha.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {isFaceSearchMode ? (
              <button onClick={() => handleSelectTour(selectedTour!)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black hover:bg-white/10"><Filter className="h-4 w-4" /> Ver todas</button>
            ) : photos.length ? (
              <button onClick={() => { setSelectionMode((current) => !current); setSelectedPhotoIds(new Set()); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black ${selectionMode ? 'border-orange-300 bg-orange-300/10 text-orange-200' : 'border-white/10 bg-white/5'}`}>{selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Selecionar</button>
            ) : null}
            {!isFaceSearchMode ? <button onClick={openScanner} disabled={!selectedTour || albumStats.searchablePhotos === 0} title={albumStats.searchablePhotos === 0 ? 'Este álbum ainda não possui retratos indexados' : undefined} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-xs font-black shadow-[0_0_20px_rgba(147,51,234,0.25)] disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4" /> Encontrar minhas fotos</button> : null}
            {selectionMode ? <button onClick={selectAll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black">{selectedPhotoIds.size === photos.length ? 'Limpar seleção' : 'Selecionar tudo'}</button> : null}
            {photos.length && !isFaceSearchMode ? <button onClick={() => void handleBulkDownload(selectionMode ? Array.from(selectedPhotoIds) : undefined)} disabled={downloadingAlbum || (selectionMode && !selectedPhotoIds.size)} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F17B37] px-4 text-xs font-black shadow-[0_0_20px_rgba(241,123,55,0.25)] disabled:opacity-50 sm:col-span-1">{downloadingAlbum ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {selectionMode ? `Baixar ${selectedPhotoIds.size || ''} selecionada(s)` : 'Baixar galeria geral'}</button> : null}
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
            {photos.map((photo, idx) => {
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
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pt-12 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/80">{isVideo ? 'Vídeo' : `Foto ${String(idx + 1).padStart(3, '0')}`}</span>
                    {!selectionMode ? <button type="button" onClick={(event) => { event.stopPropagation(); void downloadPhoto(photo, idx); }} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#071829] shadow-lg" aria-label={`Baixar ${isVideo ? 'vídeo' : 'foto'}`}>{downloadingPhotoId === photo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button> : null}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Face Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[#0F1722] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
              <button 
                onClick={() => setShowScanner(false)} 
                className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded-full text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 text-center border-b border-white/10 bg-gradient-to-b from-purple-900/40 to-transparent">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                <h3 className="text-xl font-black">Escaneamento Mágico</h3>
                <p className="text-sm text-gray-400 mt-1">Tire uma selfie para encontrarmos você nas fotos da trilha.</p>
              </div>

              <div className="relative aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="w-full h-full object-cover"
                />
                
                {/* Scanner Overlay Animation */}
                {scanning && (
                  <motion.div 
                    initial={{ top: '0%' }}
                    animate={{ top: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,1)]"
                  />
                )}
                
                {/* Result Overlay */}
                <AnimatePresence>
                  {scanResult && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${scanResult.success ? 'bg-green-900/80' : 'bg-red-900/80'}`}
                    >
                      {scanResult.success ? <CheckCircle2 className="w-16 h-16 text-green-400 mb-4" /> : <AlertCircle className="w-16 h-16 text-red-400 mb-4" />}
                      <p className="text-xl font-bold">{scanResult.message}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6">
                <button 
                  onClick={captureAndSearch}
                  disabled={scanning || !!scanResult}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" /> Tirar Foto e Buscar</>}
                </button>
              </div>
            </div>
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
