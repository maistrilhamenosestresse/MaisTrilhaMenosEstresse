"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, HardDrive, Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { deleteOfflineMapPack, getOfflineMapPack, saveOfflineMapPack, type OfflineMapPack } from "@/lib/app/offline-trails";
import { formatOfflineUpdate } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";

type DownloadPayload = {
  agendaId: string;
  generatedAt: string;
  bounds: OfflineMapPack["bounds"];
  featureCount: number;
  attribution: string;
  geojson: unknown;
  error?: string;
};

export function OfflineMapDownloadCard({
  agendaId,
  compact = false,
  onPackChange,
}: {
  agendaId: string;
  compact?: boolean;
  onPackChange?: (pack: OfflineMapPack | null) => void;
}) {
  const [pack, setPack] = useState<OfflineMapPack | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const online = useNetworkStatus();

  const loadPack = useCallback(async () => {
    const stored = await getOfflineMapPack(agendaId).catch(() => null);
    setPack(stored);
    onPackChange?.(stored);
  }, [agendaId, onPackChange]);

  useEffect(() => { void loadPack(); }, [loadPack]);

  useEffect(() => () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  const download = async () => {
    if (!online || downloading) return;
    setDownloading(true);
    setError("");
    setProgress(8);
    progressTimer.current = setInterval(() => setProgress((value) => Math.min(88, value + (value < 50 ? 7 : 2))), 650);
    try {
      await navigator.storage?.persist?.().catch(() => false);
      const response = await fetch(`/api/app/offline-map/${agendaId}`, { cache: "no-store" });
      const result = await response.json() as DownloadPayload;
      if (!response.ok) throw new Error(result.error || "Não foi possível preparar o mapa offline.");
      setProgress(94);
      const stored = await saveOfflineMapPack({
        agendaId,
        geojson: result.geojson,
        bounds: result.bounds,
        attribution: result.attribution,
        featureCount: result.featureCount,
        sourceGeneratedAt: result.generatedAt,
      });
      setPack(stored);
      setProgress(100);
      onPackChange?.(stored);
      window.dispatchEvent(new CustomEvent("mt:offline-map-updated", { detail: { agendaId } }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao baixar o mapa offline.");
      setProgress(0);
    } finally {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setDownloading(false);
    }
  };

  const remove = async () => {
    await deleteOfflineMapPack(agendaId);
    setPack(null);
    setProgress(0);
    onPackChange?.(null);
    window.dispatchEvent(new CustomEvent("mt:offline-map-updated", { detail: { agendaId } }));
  };

  const size = pack ? formatBytes(pack.byteSize) : null;

  return (
    <section className={`overflow-hidden rounded-2xl border ${pack ? "border-emerald-300/30 bg-emerald-400/10" : "border-cyan-300/20 bg-cyan-400/10"} ${compact ? "p-3.5" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${pack ? "bg-emerald-300/15 text-emerald-200" : "bg-cyan-300/15 text-cyan-200"}`}>
          {pack ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white">{pack ? "Mapa baixado neste aparelho" : "Baixar mapa para usar sem internet"}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/60">
            {pack
              ? `${pack.featureCount.toLocaleString("pt-BR")} elementos · ${size} · salvo em ${formatOfflineUpdate(pack.savedAt)}`
              : "Inclui caminhos, água, vegetação, pontos de apoio e a rota GPS ao redor da trilha."}
          </p>
        </div>
        <HardDrive className="h-4 w-4 shrink-0 text-white/35" />
      </div>

      {downloading ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-cyan-100"><span>Montando pacote offline...</span><span>{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-cyan-300 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-[10px] font-bold leading-relaxed text-red-100">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={download}
          disabled={!online || downloading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-black text-[#071829] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : pack ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {!online ? "Conecte-se para baixar" : pack ? "Atualizar mapa" : "Baixar agora"}
        </button>
        {pack && !downloading ? (
          <button type="button" onClick={remove} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/70" aria-label="Excluir mapa offline"><Trash2 className="h-4 w-4" /></button>
        ) : null}
      </div>

      {!online && !pack ? <p className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-amber-200"><WifiOff className="h-3 w-3" /> Baixe antes de chegar a uma área sem sinal.</p> : null}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
