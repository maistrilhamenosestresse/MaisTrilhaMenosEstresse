"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Sparkles, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
      } catch (err) {
        alert("Erro ao analisar a foto.");
      } finally {
        setAiLoading(false);
        setIsAiMode(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const displayPhotos = filteredPhotos !== null ? Array.from(new Set([...filteredPhotos, ...photos])) : photos;

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
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="aspect-square bg-gray-200 relative overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i}`} className="object-cover w-full h-full" loading="lazy" />
              </motion.div>
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

    </div>
  );
}
