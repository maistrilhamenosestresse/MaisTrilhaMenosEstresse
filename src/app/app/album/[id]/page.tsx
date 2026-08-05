"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Sparkles, X, Image as ImageIcon, Loader2, Download, Images, Maximize2, CheckCircle2, Square, CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { use } from "react";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [photos, setPhotos] = useState<{ id: string; url: string; type: "image" | "video" }[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAiMode, setIsAiMode] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
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
          type: photo.type === "video" ? "video" : "image",
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadPhotos();
  }, [unwrappedParams.id]);

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        
        if (data.matches && data.matches.length > 0) {
          setFilteredPhotos(data.matches);
        } else {
          alert("Nenhuma foto sua foi encontrada nesta trilha! :(");
          setFilteredPhotos(null);
        }
      } catch {
        alert("Erro ao analisar a foto.");
      } finally {
        setAiLoading(false);
        setIsAiMode(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const displayPhotos = filteredPhotos !== null
    ? Array.from(new Set(filteredPhotos)).map((url, index) => ({ id: `face-${index}`, url, type: "image" as const }))
    : photos;

  const downloadPhoto = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao baixar foto");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `mais-trilha-foto-${String(index + 1).padStart(3, "0")}.${extensionFromType(blob.type)}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
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
      <div className="mt-app-header sticky top-0 z-40 flex items-center gap-4 border-b px-4 py-3">
        <button onClick={() => router.back()} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-black text-gray-800 leading-tight">
            {filteredPhotos !== null ? 'Suas Fotos' : 'Álbum da Trilha'}
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {displayPhotos.length} {displayPhotos.length === 1 ? 'foto' : 'fotos'}
          </p>
        </div>
        {filteredPhotos !== null && (
          <button onClick={() => setFilteredPhotos(null)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            Ver Todas
          </button>
        )}
        {displayPhotos.length > 0 && (
          <button
            type="button"
            onClick={() => void downloadAlbum()}
            disabled={downloadingAlbum}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0E6] text-[#D96224] disabled:opacity-50"
            aria-label="Baixar álbum completo"
          >
            {downloadingAlbum ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Galeria */}
      <div className="p-2">
        {!loading && photos.length > 0 && filteredPhotos === null ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
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
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-32 text-gray-400 text-center px-6">
            <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">Álbum Vazio</h3>
            <p className="text-sm text-gray-500">Os fotógrafos ainda não enviaram as fotos desta aventura.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {displayPhotos.map((photo, i) => (
              <motion.button
                type="button"
                onClick={() => selectionMode ? toggleSelection(photo.id) : setSelectedPhoto(photo.url)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={photo.id}
                className={`aspect-square bg-gray-200 relative overflow-hidden group ${selectedPhotoIds.has(photo.id) ? 'ring-4 ring-inset ring-[#F17B37]' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${i}`} className="object-cover w-full h-full" loading="lazy" />
                {selectionMode ? <span className={`absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full ${selectedPhotoIds.has(photo.id) ? 'bg-[#F17B37] text-white' : 'border-2 border-white bg-black/30 text-transparent'}`}><CheckCircle2 className="h-4 w-4" /></span> : null}
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (IA) */}
      {!loading && photos.length > 0 && filteredPhotos === null && !selectionMode && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-24 left-0 right-0 px-6 flex justify-center z-50"
        >
          <button 
            onClick={() => setIsAiMode(true)}
            className="flex items-center gap-3 rounded-full bg-[#0B2540] px-6 py-4 text-sm font-black text-white shadow-xl shadow-slate-950/20 transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="w-5 h-5" />
            Achar minhas fotos com IA
          </button>
        </motion.div>
      )}

      {/* Modal da IA */}
      <AnimatePresence>
        {isAiMode && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6"
          >
            <button onClick={() => setIsAiMode(false)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white flex items-center gap-1 text-sm font-bold pr-4">
              <X className="w-5 h-5" /> Ver Paisagens e Grupos
            </button>

            <div className="text-center max-w-sm w-full bg-white rounded-3xl p-8 relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute left-0 top-0 h-32 w-full bg-gradient-to-br from-orange-100 to-blue-50" />
              
              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-orange-900/15">
                  {aiLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
                  ) : (
                    <Sparkles className="h-8 w-8 text-[#D96224]" />
                  )}
                </div>

                <h2 className="text-2xl font-black text-gray-800 mb-2">
                  {aiLoading ? 'Procurando...' : 'Filtro Mágico'}
                </h2>
                <p className="text-sm text-gray-500 font-medium mb-8">
                  {aiLoading 
                    ? 'A Inteligência Artificial da Amazon está escaneando milhares de rostos no álbum. Isso leva alguns segundos.' 
                    : 'Tire uma selfie agora mesmo e nossa Inteligência Artificial vai vasculhar o álbum inteiro para te encontrar!'}
                </p>

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
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Camera className="w-5 h-5" />
                  {aiLoading ? 'Analisando Rosto...' : 'Tirar Selfie Agora'}
                </button>
              </div>
            </div>
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
                onClick={() => downloadPhoto(selectedPhoto, Math.max(0, displayPhotos.findIndex((photo) => photo.url === selectedPhoto)))}
                className="rounded-full bg-white text-gray-900 px-4 py-2.5 font-black text-sm flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Baixar foto
              </button>
            </header>
            <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPhoto} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function extensionFromType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  return "jpg";
}
