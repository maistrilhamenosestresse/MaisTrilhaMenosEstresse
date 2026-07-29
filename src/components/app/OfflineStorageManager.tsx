"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, HardDrive, Loader2, MapPinned, RefreshCw, Trash2 } from "lucide-react";
import {
  clearAllOfflineTrailData,
  deleteOfflineMapPack,
  listOfflineMapPacks,
  type OfflineMapPack,
} from "@/lib/app/offline-trails";
import { formatOfflineUpdate } from "@/lib/app/offline-data";

type StorageSummary = {
  usage: number;
  quota: number;
};

export function OfflineStorageManager() {
  const [packs, setPacks] = useState<OfflineMapPack[]>([]);
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [savedPacks, estimate] = await Promise.all([
        listOfflineMapPacks().catch(() => []),
        navigator.storage?.estimate?.().catch(() => null),
      ]);
      setPacks(savedPacks);
      setStorage(
        estimate
          ? { usage: estimate.usage || 0, quota: estimate.quota || 0 }
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleUpdate = () => void refresh();
    window.addEventListener("mt:offline-map-updated", handleUpdate);
    return () => window.removeEventListener("mt:offline-map-updated", handleUpdate);
  }, [refresh]);

  const totalMapBytes = useMemo(
    () => packs.reduce((total, pack) => total + (pack.byteSize || 0), 0),
    [packs],
  );

  const removePack = async (pack: OfflineMapPack) => {
    if (!window.confirm(`Remover o mapa offline de “${pack.title || "esta trilha"}”?`)) return;
    setBusyId(pack.agendaId);
    setMessage("");
    try {
      await deleteOfflineMapPack(pack.agendaId);
      setPacks((current) => current.filter((item) => item.agendaId !== pack.agendaId));
      setMessage("Mapa removido deste aparelho.");
      window.dispatchEvent(new CustomEvent("mt:offline-map-updated", { detail: { agendaId: pack.agendaId } }));
    } catch {
      setMessage("Não foi possível remover o mapa. Tente novamente.");
    } finally {
      setBusyId("");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Remover todos os mapas e dados de trilhas salvos neste aparelho?")) return;
    setBusyId("all");
    setMessage("");
    try {
      await clearAllOfflineTrailData();
      setPacks([]);
      setMessage("Todos os dados offline foram removidos.");
      window.dispatchEvent(new CustomEvent("mt:offline-map-updated"));
    } catch {
      setMessage("Não foi possível limpar os dados offline.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0B2540] text-white">
          <MapPinned className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#D96224]">
            Mapas offline
          </p>
          <h2 className="text-base font-black text-[#071829]">Downloads deste aparelho</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Baixe o mapa na página de cada trilha antes de sair. A rota e os detalhes salvos continuam disponíveis sem sinal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-50"
          aria-label="Atualizar lista de mapas offline"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-500">Mapas salvos</p>
            <p className="mt-1 text-xl font-black text-[#071829]">{packs.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-500">Espaço dos mapas</p>
            <p className="mt-1 text-xl font-black text-[#071829]">{formatBytes(totalMapBytes)}</p>
          </div>
        </div>

        {storage?.quota ? (
          <div className="mb-4 rounded-2xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Armazenamento do aplicativo</span>
              <span>{formatBytes(storage.usage)} de {formatBytes(storage.quota)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#D96224]"
                style={{ width: `${Math.min(100, Math.max(2, (storage.usage / storage.quota) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando downloads...
          </div>
        ) : packs.length ? (
          <div className="space-y-2">
            {packs.map((pack) => (
              <article key={pack.agendaId} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
                  <Database className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#071829]">{pack.title || "Mapa de trilha salvo"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatBytes(pack.byteSize)} · {pack.featureCount.toLocaleString("pt-BR")} elementos · {formatOfflineUpdate(pack.savedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removePack(pack)}
                  disabled={Boolean(busyId)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-100 text-red-600 disabled:opacity-40"
                  aria-label={`Remover mapa offline de ${pack.title || "trilha"}`}
                >
                  {busyId === pack.agendaId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <MapPinned className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-black text-[#071829]">Nenhum mapa baixado</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Abra uma trilha, expanda o mapa e toque em “Baixar agora”.
            </p>
          </div>
        )}

        {message ? <p role="status" className="mt-3 text-xs font-bold text-slate-600">{message}</p> : null}

        {packs.length ? (
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={Boolean(busyId)}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-100 px-4 text-xs font-black text-red-700 disabled:opacity-40"
          >
            {busyId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover todos os downloads
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
