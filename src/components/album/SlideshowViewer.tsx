"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download, Play, Pause } from "lucide-react";

interface SlideshowViewerProps {
  photos: { url: string; type?: "image" | "video" }[];
  initialIndex: number;
  onClose: () => void;
  title?: string;
}

export function SlideshowViewer({ photos, initialIndex, onClose, title = "Álbum da trilha" }: SlideshowViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  }, [photos.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  }, [photos.length]);

  // Slideshow play effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(handleNext, 4000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  // Handle Download
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      
      const ext = blob.type.includes('png') ? 'png'
        : blob.type.includes('webp') ? 'webp'
          : blob.type.includes('quicktime') ? 'mov'
            : blob.type.includes('video') ? 'mp4'
              : 'jpg';
      
      link.download = `maistrilha_foto_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Se der CORS no blob (as vezes o presigned S3 requer cors na fetch), fallback:
      window.open(url, "_blank");
    }
  };

  const currentPhoto = photos[currentIndex];
  const isVideo = currentPhoto?.type === 'video' || /\.(mp4|mov|m4v)(?:\?|$)/i.test(currentPhoto?.url || '');

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center"
      >
        {/* Top Bar */}
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/90 to-transparent p-3 pb-10 sm:p-4 sm:pb-12">
          <div className="flex min-w-0 items-center gap-3 text-white">
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
            <span className="min-w-0"><span className="block truncate text-xs font-black sm:text-sm">{title}</span><span className="block text-[10px] font-bold tracking-widest text-white/55">{currentIndex + 1} / {photos.length}</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
              title="Apresentação de Slides"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => handleDownload(currentPhoto.url)}
              className="px-4 py-2 bg-[#F17B37] hover:bg-orange-500 rounded-full transition-colors text-white font-bold flex items-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Baixar</span>
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="group relative flex h-full w-full items-center justify-center overflow-hidden px-0 pb-24 pt-16 sm:p-20">
          <button 
            onClick={handlePrev}
            aria-label="Foto anterior"
            className="absolute left-2 z-10 rounded-full bg-black/50 p-2 text-white opacity-100 backdrop-blur-md transition hover:bg-black/80 sm:left-8 sm:p-3 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60 || info.velocity.x < -450) handleNext();
                if (info.offset.x > 60 || info.velocity.x > 450) handlePrev();
              }}
              className="flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
            >
              {isVideo ? (
                <video 
                  src={currentPhoto.url} 
                  controls 
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full object-contain drop-shadow-2xl"
                />
              ) : (
                <img 
                  src={currentPhoto.url} 
                  alt="Trilha" 
                  className="max-w-full max-h-full object-contain drop-shadow-2xl select-none"
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <button 
            onClick={handleNext}
            aria-label="Próxima foto"
            className="absolute right-2 z-10 rounded-full bg-black/50 p-2 text-white opacity-100 backdrop-blur-md transition hover:bg-black/80 sm:right-8 sm:p-3 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2 overflow-x-auto bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12 no-scrollbar sm:justify-center">
          {photos.map((photo, idx) => {
            const isVid = photo.type === 'video' || /\.(mp4|mov|m4v)(?:\?|$)/i.test(photo.url);
            return (
              <button 
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:h-14 sm:w-14 ${idx === currentIndex ? 'border-[#F17B37] scale-105 opacity-100 shadow-[0_0_18px_rgba(241,123,55,.45)]' : 'border-transparent opacity-45 hover:opacity-100'}`}
              >
                {isVid ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white/80" />
                  </div>
                ) : (
                  <img src={photo.url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                )}
              </button>
            )
          })}
        </div>
        {isPlaying ? <motion.div key={currentIndex} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 4, ease: 'linear' }} className="absolute left-0 top-0 z-30 h-1 bg-[#F17B37]" /> : null}
      </motion.div>
    </AnimatePresence>
  );
}
