"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Move, X, ZoomIn } from "lucide-react";

type ProfilePhotoCropperProps = {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
};

const CROP_SIZE = 288;
const OUTPUT_SIZE = 640;

export function ProfilePhotoCropper({ file, onCancel, onConfirm }: ProfilePhotoCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
  }, [file]);

  if (!file) return null;

  const dimensions = () => {
    const image = imageRef.current;
    if (!image) return null;
    const baseScale = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight);
    const scale = baseScale * zoom;
    return {
      image,
      scale,
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale,
    };
  };

  const clampOffset = (next: { x: number; y: number }) => {
    const current = dimensions();
    if (!current) return next;
    const maxX = Math.max(0, (current.width - CROP_SIZE) / 2);
    const maxY = Math.max(0, (current.height - CROP_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset(clampOffset({
      x: dragRef.current.offsetX + event.clientX - dragRef.current.x,
      y: dragRef.current.offsetY + event.clientY - dragRef.current.y,
    }));
  };

  const finishDrag = () => {
    dragRef.current = null;
  };

  const updateZoom = (value: number) => {
    setZoom(value);
    window.requestAnimationFrame(() => setOffset((current) => clampOffset(current)));
  };

  const confirm = async () => {
    const current = dimensions();
    if (!current) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a foto.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const outputScale = OUTPUT_SIZE / CROP_SIZE;
      const drawWidth = current.width * outputScale;
      const drawHeight = current.height * outputScale;
      const drawX = (CROP_SIZE / 2 + offset.x) * outputScale - drawWidth / 2;
      const drawY = (CROP_SIZE / 2 + offset.y) * outputScale - drawHeight / 2;
      context.drawImage(current.image, drawX, drawY, drawWidth, drawHeight);

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

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md p-4 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl">
        <header className="p-5 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Foto de perfil</p>
            <h2 className="font-black text-gray-900">Ajuste antes de enviar</h2>
          </div>
          <button type="button" onClick={onCancel} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </header>

        <div className="p-5">
          <div
            className="relative mx-auto rounded-full overflow-hidden bg-slate-900 touch-none select-none cursor-move"
            style={{ width: CROP_SIZE, height: CROP_SIZE, maxWidth: "100%", aspectRatio: "1" }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={objectUrl}
              alt="Prévia para recorte"
              draggable={false}
              onLoad={() => setLoaded(true)}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                minWidth: "100%",
                minHeight: "100%",
                objectFit: "cover",
              }}
            />
            <div className="absolute inset-0 rounded-full ring-[999px] ring-black/35 pointer-events-none" />
          </div>

          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Move className="w-4 h-4 text-gray-500" />
              <p className="text-xs text-gray-600 flex-1">Arraste a foto para enquadrar seu rosto.</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <ZoomIn className="w-4 h-4 text-purple-600" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="flex-1 accent-purple-600"
              />
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-gray-100 font-black text-gray-600">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || !loaded}
            className="flex-[1.4] py-3.5 rounded-2xl bg-purple-600 font-black text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Usar foto
          </button>
        </footer>
      </div>
    </div>
  );
}
