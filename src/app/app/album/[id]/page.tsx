"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Sparkles, X, Image as ImageIcon, Loader2, Download, Images, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { use } from "react";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAiMode, setIsAiMode] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [downloadingAlbum, setDownloadingAlbum] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await fetch(`/api/album/${unwrappedParams.id}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        setPhotos(data.photos?.map((f: any) => f.aws_url) || []);
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

  const displayPhotos = filteredPhotos !== null ? Array.from(new Set([...filteredPhotos, ...photos])) : photos;

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

  const downloadAlbum = async () => {
    if (!displayPhotos.length) return;
    setDownloadingAlbum(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const results = await Promise.allSettled(
        displayPhotos.map(async (url, index) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Falha ao baixar foto");
          const blob = await response.blob();
          zip.file(
            `foto-${String(index + 1).padStart(3, "0")}.${extensionFromType(blob.type)}`,
            await blob.arrayBuffer(),
          );
        }),
      );
      if (results.every((result) => result.status === "rejected")) {
        throw new Error("Nenhuma foto pôde ser baixada");
      }
      const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const objectUrl = URL.createObjectURL(archive);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-40 shadow-sm">
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
            onClick={downloadAlbum}
            disabled={downloadingAlbum}
            className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center disabled:opacity-50"
            aria-label="Baixar álbum completo"
          >
            {downloadingAlbum ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Galeria */}
      <div className="p-2">
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
            {displayPhotos.map((url, i) => (
              <motion.button
                type="button"
                onClick={() => setSelectedPhoto(url)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="aspect-square bg-gray-200 relative overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i}`} className="object-cover w-full h-full" loading="lazy" />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (IA) */}
      {!loading && photos.length > 0 && filteredPhotos === null && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-24 left-0 right-0 px-6 flex justify-center z-50"
        >
          <button 
            onClick={() => setIsAiMode(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl shadow-purple-500/30 px-6 py-4 rounded-full font-black text-sm flex items-center gap-3 hover:scale-105 transition-transform"
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
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-purple-100 to-blue-50" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-white shadow-xl shadow-purple-500/20 rounded-full mx-auto flex items-center justify-center mb-6">
                  {aiLoading ? (
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-purple-600" />
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
                onClick={() => downloadPhoto(selectedPhoto, displayPhotos.indexOf(selectedPhoto))}
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
