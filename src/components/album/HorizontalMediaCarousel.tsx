"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, Film, Images, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type CarouselMedia = {
  id: string;
  url: string;
  type: "image" | "video";
  label?: string;
};

type Props = {
  items: CarouselMedia[];
  tone?: "dark" | "light";
  onExpand: (item: CarouselMedia, index: number) => void;
  onDownload?: (item: CarouselMedia, index: number) => void;
  downloadingId?: string | null;
};

export function HorizontalMediaCarousel({ items, tone = "dark", onExpand, onDownload, downloadingId }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  const active = items[safeActiveIndex];
  const dark = tone === "dark";
  if (!active) return null;

  const move = (direction: number) => {
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  return (
    <section className={`overflow-hidden rounded-[1.6rem] border shadow-xl ${dark ? "border-white/10 bg-[#07131f]" : "border-slate-200 bg-white"}`}>
      <div
        className="relative aspect-[4/3] max-h-[68vh] w-full touch-pan-y overflow-hidden bg-black outline-none focus-visible:ring-4 focus-visible:ring-[#F17B37]/60 sm:aspect-[16/10]"
        role="region"
        aria-label="Visualizador do álbum"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
        }}
        onPointerDown={(event) => { pointerStartX.current = event.clientX; }}
        onPointerCancel={() => { pointerStartX.current = null; }}
        onPointerUp={(event) => {
          if (pointerStartX.current === null) return;
          const distance = event.clientX - pointerStartX.current;
          pointerStartX.current = null;
          if (Math.abs(distance) < 45) return;
          move(distance > 0 ? -1 : 1);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.22 }} className="absolute inset-0 grid place-items-center">
            {active.type === "video" ? (
              <video src={active.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.url} alt={active.label || `Foto ${activeIndex + 1}`} className="h-full w-full object-contain" />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-black backdrop-blur-md">
            {active.type === "video" ? <Film className="h-3.5 w-3.5" /> : <Images className="h-3.5 w-3.5" />}
            {safeActiveIndex + 1} de {items.length}
          </span>
          <span className="truncate text-[10px] font-bold text-white/70">{active.label}</span>
        </div>

        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md" aria-label="Mídia anterior"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md" aria-label="Próxima mídia"><ChevronRight className="h-6 w-6" /></button>
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10">
          {onDownload ? <button type="button" onClick={() => onDownload(active, safeActiveIndex)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md" aria-label="Baixar mídia">{downloadingId === active.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button> : null}
          <button type="button" onClick={() => onExpand(active, safeActiveIndex)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-[10px] font-black text-[#071829] shadow-lg"><Expand className="h-4 w-4" /> Expandir</button>
        </div>
      </div>

      <div className={`flex snap-x gap-2 overflow-x-auto p-2.5 [scrollbar-width:thin] ${dark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
        {items.map((item, index) => (
          <button key={item.id} type="button" onClick={() => setActiveIndex(index)} className={`relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition ${index === safeActiveIndex ? "border-[#F17B37] ring-2 ring-orange-300/20" : dark ? "border-white/10 opacity-55" : "border-white opacity-60"}`} aria-label={`Abrir mídia ${index + 1}`}>
            {item.type === "video" ? <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
            {item.type === "video" ? <span className="absolute inset-0 grid place-items-center bg-black/20"><Film className="h-4 w-4 text-white" /></span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
