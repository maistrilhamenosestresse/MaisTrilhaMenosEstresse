"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Sparkles, X, Image as ImageIcon, Loader2, Download, Images, CheckCircle2, Square, CheckSquare, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HorizontalMediaCarousel } from "@/components/album/HorizontalMediaCarousel";

import { use } from "react";

type AlbumStats = {
  total: number;
  publicMedia: number;
  searchablePhotos: number;
  landscapes: number;
  groups: number;
  privatePortraits: number;
  videos: number;
};

type AlbumMedia = { id: string; url: string; downloadUrl?: string; type: "image" | "video" };

const EMPTY_STATS: AlbumStats = {
  total: 0,
  publicMedia: 0,
  searchablePhotos: 0,
  landscapes: 0,
  groups: 0,
  privatePortraits: 0,
  videos: 0,
};
const INITIAL_MEDIA_COUNT = 18;

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [photos, setPhotos] = useState<AlbumMedia[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<AlbumMedia[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScanStep, setAiScanStep] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<AlbumMedia | null>(null);
  const [albumStats, setAlbumStats] = useState<AlbumStats>(EMPTY_STATS);
  const [visibleMediaCount, setVisibleMediaCount] = useState(INITIAL_MEDIA_COUNT);
  const [downloadingAlbum, setDownloadingAlbum] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await fetch(`/api/album/${unwrappedParams.id}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        setPhotos((data.photos || []).map((photo: any, index: number) => ({
          id: String(photo.id || `media-${index}`),
          url: String(photo.aws_url || ""),
          downloadUrl: String(photo.download_url || photo.aws_url || ""),
          type: photo.type === "video" ? "video" : "image",
        })));
        setAlbumStats({ ...EMPTY_STATS, ...(data.stats || {}) });
        setVisibleMediaCount(INITIAL_MEDIA_COUNT);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadPhotos();
  }, [unwrappedParams.id]);

  useEffect(() => {
    if (!aiLoading) {
      setAiScanStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAiScanStep((current) => Math.min(current + 1, 2));
    }, 850);
    return () => window.clearInterval(timer);
  }, [aiLoading]);

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiFeedback(null);
    if (!file.type.startsWith("image/")) {
      setAiFeedback({ success: false, message: "Escolha uma foto ou selfie válida." });
      return;
    }
    if (file.size > 10_000_000) {
      setAiFeedback({ success: false, message: "A selfie deve ter no máximo 10 MB." });
      return;
    }

    setAiLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;

      try {
        const res = await fetch('/api/ai/find-faces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agendaId: unwrappedParams.id, imageBase64: base64 })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Não foi possível analisar a selfie.");

        if (data.matches && data.matches.length > 0) {
          setFilteredPhotos(data.matches.map((match: string | { id?: string; url?: string; download_url?: string }, index: number) => ({
            id: typeof match === "string" ? `face-${index}` : String(match.id || `face-${index}`),
            url: typeof match === "string" ? match : String(match.url || ""),
            downloadUrl: typeof match === "string" ? match : String(match.download_url || match.url || ""),
            type: "image" as const,
          })).filter((media: AlbumMedia) => Boolean(media.url)));
          setVisibleMediaCount(INITIAL_MEDIA_COUNT);
          setAiFeedback({ success: true, message: `${data.matches.length} foto(s) encontrada(s).` });
          window.setTimeout(() => setIsAiMode(false), 1100);
        } else {
          setAiFeedback({ success: false, message: "Não encontramos você. Tente outra selfie com o rosto de frente e boa iluminação." });
          setFilteredPhotos(null);
        }
      } catch (error) {
        setAiFeedback({ success: false, message: error instanceof Error ? error.message : "Erro ao analisar a selfie." });
      } finally {
        setAiLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const displayPhotos: AlbumMedia[] = filteredPhotos !== null
    ? Array.from(new Map(filteredPhotos.map((media) => [media.id, media])).values())
    : photos;
  const visiblePhotos = displayPhotos.slice(0, visibleMediaCount);

  const downloadPhoto = async (media: AlbumMedia, index: number) => {
    try {
      const response = await fetch(media.downloadUrl || media.url);
      if (!response.ok) throw new Error("Falha ao baixar foto");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `mais-trilha-${media.type === "video" ? "video" : "foto"}-${String(index + 1).padStart(3, "0")}.${extensionFromType(blob.type, media.type)}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(media.downloadUrl || media.url, "_blank", "noopener,noreferrer");
    }
  };

  const downloadAlbum = async (photoIds?: string[]) => {
    if (!displayPhotos.length) return;
    setDownloadingAlbum(true);
    try {
      const response = await fetch(`/api/album/${unwrappedParams.id}/download`, photoIds?.length ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds }),
      } : { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Nenhuma foto pôde ser baixada");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `album-mais-trilha-${unwrappedParams.id.slice(0, 8)}.zip`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      alert(downloadError.message || "Não foi possível baixar o álbum.");
    } finally {
      setDownloadingAlbum(false);
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

  return (
    <div className="mt-app-page flex min-h-full flex-col pb-24">
      {/* Header */}
      <div className="mt-app-header sticky top-0 z-40 flex items-center gap-2 border-b px-3 py-2.5 backdrop-blur-xl">
        <button onClick={() => router.back()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-50 transition-colors hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="truncate text-sm font-black leading-tight text-gray-800">
            {filteredPhotos !== null ? 'Fotos encontradas' : 'Álbum da trilha'}
          </h1>
          <p className="text-[10px] font-medium text-gray-500">
            {displayPhotos.length} {displayPhotos.length === 1 ? 'arquivo' : 'arquivos'}
          </p>
        </div>
        {filteredPhotos !== null && (
          <button onClick={() => setFilteredPhotos(null)} className="rounded-full bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-700">
            Galeria geral
          </button>
        )}
        {displayPhotos.length > 0 && filteredPhotos === null && (
          <button
            type="button"
            onClick={() => void downloadAlbum()}
            disabled={downloadingAlbum}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0E6] text-[#D96224] disabled:opacity-50"
            aria-label="Baixar álbum completo"
          >
            {downloadingAlbum ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Galeria */}
      <div className="p-2 pt-1">
        {!loading && filteredPhotos === null && (albumStats.publicMedia > 0 || albumStats.searchablePhotos > 0) ? (
          <section className="mb-2 flex items-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0B2540,#173E63)] p-3 text-white shadow-md">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-orange-200"><Images className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-black">Galeria geral</h2>
              <p className="mt-0.5 text-[10px] font-bold text-blue-100/65">{albumStats.publicMedia} mídias · {albumStats.videos} vídeos</p>
            </div>
            {albumStats.searchablePhotos > 0 ? (
              <button type="button" onClick={() => { setAiFeedback(null); setIsAiMode(true); }} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-black text-[#0B2540] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Me encontrar
              </button>
            ) : null}
          </section>
        ) : null}
        {!loading && photos.length > 0 && filteredPhotos === null ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
            <button type="button" onClick={() => { setSelectionMode((current) => !current); setSelectedPhotoIds(new Set()); }} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black ${selectionMode ? 'bg-[#0B2540] text-white' : 'bg-gray-100 text-gray-700'}`}>
              {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} {selectionMode ? `${selectedPhotoIds.size} selecionada(s)` : 'Selecionar fotos'}
            </button>
            {selectionMode ? <button type="button" onClick={() => setSelectedPhotoIds((current) => current.size === photos.length ? new Set() : new Set(photos.map((photo) => photo.id)))} className="min-h-10 rounded-xl bg-gray-100 px-3 text-xs font-black text-gray-700">{selectedPhotoIds.size === photos.length ? 'Limpar' : 'Todas'}</button> : null}
            {selectionMode ? <button type="button" disabled={!selectedPhotoIds.size || downloadingAlbum} onClick={() => void downloadAlbum(Array.from(selectedPhotoIds))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#D96224] text-white disabled:opacity-40">{downloadingAlbum ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button> : null}
          </div>
        ) : null}
        {loading ? (
          <div className="flex flex-col items-center justify-center pt-32 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Carregando memórias...</p>
          </div>
        ) : displayPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-32 text-gray-400 text-center px-6">
            <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">{albumStats.searchablePhotos > 0 ? "Seus retratos estão protegidos" : "Álbum vazio"}</h3>
            <p className="text-sm text-gray-500">
              {albumStats.searchablePhotos > 0
                ? "Use o reconhecimento facial para localizar somente as fotos em que você aparece."
                : "Os fotógrafos ainda não enviaram as fotos desta aventura."}
            </p>
            {albumStats.searchablePhotos > 0 && filteredPhotos === null ? (
              <button type="button" onClick={() => setIsAiMode(true)} className="mt-5 flex min-h-12 items-center gap-2 rounded-2xl bg-[#0B2540] px-5 text-sm font-black text-white shadow-lg">
                <Sparkles className="h-5 w-5" /> Encontrar minhas fotos
              </button>
            ) : null}
          </div>
        ) : selectionMode ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {visiblePhotos.map((photo, index) => {
              const selected = selectedPhotoIds.has(photo.id);
              return <button key={photo.id} type="button" onClick={() => toggleSelection(photo.id)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-900 ${selected ? "border-[#F17B37] ring-2 ring-orange-300/25" : "border-white"}`}>{photo.type === "video" ? <video src={photo.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={photo.url} alt={`Foto ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />}<span className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full ${selected ? "bg-[#F17B37] text-white" : "border-2 border-white bg-black/40 text-transparent"}`}><CheckCircle2 className="h-4 w-4" /></span></button>;
            })}
          </div>
        ) : (
          <HorizontalMediaCarousel
            items={visiblePhotos.map((photo, index) => ({ ...photo, label: photo.type === "video" ? `Vídeo ${index + 1}` : `Foto ${index + 1}` }))}
            tone="light"
            onExpand={(item, index) => setSelectedPhoto(visiblePhotos[index] || { id: item.id, url: item.url, type: item.type })}
            onDownload={(item, index) => void downloadPhoto(visiblePhotos[index] || { id: item.id, url: item.url, type: item.type }, index)}
          />
        )}
        {!loading && displayPhotos.length > INITIAL_MEDIA_COUNT ? (
          <div className="flex justify-center py-5">
            {visibleMediaCount < displayPhotos.length ? (
              <button type="button" onClick={() => setVisibleMediaCount((current) => Math.min(current + INITIAL_MEDIA_COUNT, displayPhotos.length))} className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#0B2540] px-5 text-xs font-black text-white shadow-lg">
                <ChevronDown className="h-4 w-4" /> Carregar mais {Math.min(INITIAL_MEDIA_COUNT, displayPhotos.length - visibleMediaCount)}
              </button>
            ) : (
              <button type="button" onClick={() => setVisibleMediaCount(INITIAL_MEDIA_COUNT)} className="flex min-h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-xs font-black text-gray-700 shadow-sm">
                <ChevronUp className="h-4 w-4" /> Recolher galeria
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Modal da IA */}
      <AnimatePresence>
        {isAiMode && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[#03111f]/95 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:items-center sm:p-6"
          >
            <motion.div initial={{ y: 36, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 36, scale: 0.97 }} className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(155deg,#102b45,#071829)] p-5 text-center text-white shadow-2xl">
              <button type="button" onClick={() => setIsAiMode(false)} className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white" aria-label="Fechar reconhecimento facial">
                <X className="h-5 w-5" />
              </button>

              <div className="relative mx-auto mb-4 h-44 w-36">
                <motion.span animate={aiLoading ? { scale: [0.92, 1.08, 0.92], opacity: [0.15, 0.35, 0.15] } : { scale: 1, opacity: 0.18 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-1 rounded-full bg-purple-400 blur-2xl" />
                <div className="absolute inset-0 overflow-hidden rounded-[4rem] border border-white/15 bg-white/[0.04]">
                  <div className="absolute left-1/2 top-8 h-16 w-16 -translate-x-1/2 rounded-full border-2 border-dashed border-white/40" />
                  <div className="absolute bottom-5 left-1/2 h-16 w-24 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-dashed border-white/30" />
                  {aiLoading ? <motion.span initial={{ top: "8%" }} animate={{ top: "88%" }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2, ease: "easeInOut" }} className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-orange-300 to-transparent shadow-[0_0_14px_rgba(253,186,116,1)]" /> : null}
                </div>
                <span className="absolute left-0 top-5 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-orange-300" />
                <span className="absolute right-0 top-5 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-orange-300" />
                <span className="absolute bottom-5 left-0 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-orange-300" />
                <span className="absolute bottom-5 right-0 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-orange-300" />
                <span className="absolute inset-0 grid place-items-center"><Camera className="h-7 w-7 text-white/75" /></span>
              </div>

              <h2 className="text-xl font-black">
                {aiLoading ? ["Validando selfie", "Comparando rostos", "Organizando suas fotos"][aiScanStep] : aiFeedback?.success ? "Você foi encontrado!" : "Encontre suas fotos"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-blue-100/65">
                {aiLoading ? "Nossa busca analisa ângulos e iluminação em duas etapas." : "Use uma selfie de frente, sem óculos escuros e com boa luz."}
              </p>

              <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((step) => <span key={step} className={`h-1.5 rounded-full transition-all duration-500 ${aiLoading && step <= aiScanStep ? "w-7 bg-orange-300" : "w-1.5 bg-white/20"}`} />)}
              </div>

              {aiFeedback ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-left text-xs font-bold ${aiFeedback.success ? "bg-emerald-400/15 text-emerald-100" : "bg-red-400/15 text-red-100"}`}>
                  {aiFeedback.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{aiFeedback.message}</span>
                </motion.div>
              ) : null}

              <input
                type="file"
                accept="image/*"
                capture="user"
                ref={fileInputRef}
                onChange={handleSelfieUpload}
                className="hidden"
              />

              <button
                disabled={aiLoading}
                onClick={() => { setAiFeedback(null); fileInputRef.current?.click(); }}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F17B37] px-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(241,123,55,0.25)] disabled:opacity-60"
              >
                {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                {aiLoading ? 'Buscando com segurança...' : aiFeedback ? 'Tentar outra selfie' : 'Tirar selfie'}
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] font-bold text-white/40">
                <CheckCircle2 className="h-3 w-3" /> Sua selfie é usada somente nesta busca
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 flex flex-col"
          >
            <header className="p-4 flex items-center justify-between text-white">
              <button type="button" onClick={() => setSelectedPhoto(null)} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => downloadPhoto(selectedPhoto, Math.max(0, displayPhotos.findIndex((photo) => photo.url === selectedPhoto.url)))}
                className="rounded-full bg-white text-gray-900 px-4 py-2.5 font-black text-sm flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Baixar foto
              </button>
            </header>
            <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
              {selectedPhoto.type === "video" ? (
                <video src={selectedPhoto.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl object-contain" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selectedPhoto.url} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded-xl" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function extensionFromType(contentType: string, mediaType: "image" | "video") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mp4")) return "mp4";
  return mediaType === "video" ? "mp4" : "jpg";
}
