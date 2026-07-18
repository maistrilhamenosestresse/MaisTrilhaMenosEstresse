"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Minus, Move, Plus, X, ZoomIn } from "lucide-react";

type ProfilePhotoCropperProps = {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
};

type Point = { x: number; y: number };

const OUTPUT_SIZE = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ProfilePhotoCropper({ file, onCancel, onConfirm }: ProfilePhotoCropperProps) {
  const cropRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{
    center: Point;
    distance: number;
    zoom: number;
    offset: Point;
  } | null>(null);
  const [cropSize, setCropSize] = useState(288);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  const baseScale = naturalSize.width && naturalSize.height
    ? Math.max(cropSize / naturalSize.width, cropSize / naturalSize.height)
    : 1;
  const baseWidth = naturalSize.width * baseScale;
  const baseHeight = naturalSize.height * baseScale;

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 0, height: 0 });
    setLoaded(false);
    pointersRef.current.clear();
    gestureRef.current = null;
  }, [file]);

  useEffect(() => {
    const element = cropRef.current;
    if (!element) return;
    const updateSize = () => setCropSize(Math.round(element.getBoundingClientRect().width));
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [file]);

  const clampOffset = (next: Point, nextZoom = zoom) => {
    const maxX = Math.max(0, (baseWidth * nextZoom - cropSize) / 2);
    const maxY = Math.max(0, (baseHeight * nextZoom - cropSize) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const updateZoom = (nextValue: number, anchor?: Point) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextValue));
    let nextOffset = offset;
    if (anchor && zoom > 0) {
      const factor = nextZoom / zoom;
      nextOffset = {
        x: anchor.x - (anchor.x - offset.x) * factor,
        y: anchor.y - (anchor.y - offset.y) * factor,
      };
    }
    setZoom(nextZoom);
    setOffset(clampOffset(nextOffset, nextZoom));
  };

  const pointerCenter = () => {
    const points = [...pointersRef.current.values()];
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  };

  const pointerDistance = () => {
    const [first, second] = [...pointersRef.current.values()];
    return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
  };

  const localPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
  };

  const startPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, localPoint(event));
    gestureRef.current = {
      center: pointerCenter(),
      distance: pointerDistance(),
      zoom,
      offset,
    };
  };

  const movePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !gestureRef.current) return;
    pointersRef.current.set(event.pointerId, localPoint(event));
    const center = pointerCenter();
    const start = gestureRef.current;

    if (pointersRef.current.size >= 2 && start.distance > 0) {
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, start.zoom * (pointerDistance() / start.distance)),
      );
      const factor = nextZoom / start.zoom;
      const nextOffset = {
        x: center.x - start.center.x + start.center.x - (start.center.x - start.offset.x) * factor,
        y: center.y - start.center.y + start.center.y - (start.center.y - start.offset.y) * factor,
      };
      setZoom(nextZoom);
      setOffset(clampOffset(nextOffset, nextZoom));
      return;
    }

    setOffset(clampOffset({
      x: start.offset.x + center.x - start.center.x,
      y: start.offset.y + center.y - start.center.y,
    }));
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size) {
      gestureRef.current = {
        center: pointerCenter(),
        distance: pointerDistance(),
        zoom,
        offset,
      };
    } else {
      gestureRef.current = null;
    }
  };

  const confirm = async () => {
    const image = imageRef.current;
    if (!image || !loaded) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a foto.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const outputScale = OUTPUT_SIZE / cropSize;
      const drawWidth = baseWidth * zoom * outputScale;
      const drawHeight = baseHeight * zoom * outputScale;
      const drawX = (cropSize / 2 + offset.x) * outputScale - drawWidth / 2;
      const drawY = (cropSize / 2 + offset.y) * outputScale - drawHeight / 2;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("Falha ao recortar a foto.")),
          "image/jpeg",
          0.9,
        );
      });
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">Foto de perfil</p>
            <h2 className="font-black text-gray-900">Ajuste antes de enviar</h2>
          </div>
          <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </header>

        <div className="p-5">
          <div
            ref={cropRef}
            className="relative mx-auto aspect-square w-[min(300px,calc(100vw-72px))] cursor-move touch-none select-none overflow-hidden rounded-full bg-slate-900"
            onPointerDown={startPointer}
            onPointerMove={movePointer}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={objectUrl}
              alt="Prévia para recorte"
              draggable={false}
              onLoad={(event) => {
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setLoaded(true);
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
              style={{
                width: baseWidth || undefined,
                height: baseHeight || undefined,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-[999px] ring-black/35" />
            <div className="pointer-events-none absolute inset-[33%] rounded-full border border-white/35" />
          </div>

          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Move className="h-4 w-4 text-gray-500" />
              <p className="flex-1 text-xs text-gray-600">Arraste com um dedo. Use dois dedos para ampliar.</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={() => updateZoom(zoom - 0.15)} aria-label="Diminuir zoom" className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm">
                <Minus className="h-4 w-4" />
              </button>
              <ZoomIn className="h-4 w-4 text-[#D96224]" />
              <input
                aria-label="Zoom da foto"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="min-w-0 flex-1 accent-[#F17B37]"
              />
              <button type="button" onClick={() => updateZoom(zoom + 0.15)} aria-label="Aumentar zoom" className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <footer className="flex gap-3 border-t border-gray-100 p-4">
          <button type="button" onClick={onCancel} className="flex-1 rounded-2xl bg-gray-100 py-3.5 font-black text-gray-600">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || !loaded}
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-3.5 font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Usar foto
          </button>
        </footer>
      </div>
    </div>
  );
}
