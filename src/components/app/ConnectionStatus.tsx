"use client";

import { CloudOff, CloudSun } from "lucide-react";
import { useNetworkStatus } from "@/lib/app/use-network-status";

export function ConnectionStatus() {
  const online = useNetworkStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 top-[max(.65rem,env(safe-area-inset-top))] z-[190] -translate-x-1/2 transition-all duration-300 ${online ? "-translate-y-16 opacity-0" : "translate-y-0 opacity-100"}`}
    >
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-2 text-[11px] font-black text-amber-900 shadow-lg backdrop-blur">
        <CloudOff className="h-4 w-4" />
        Modo offline · dados salvos disponíveis
      </div>
    </div>
  );
}

export function InlineConnectionStatus({ savedAt }: { savedAt?: string | null }) {
  const online = useNetworkStatus();
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {online ? <CloudSun className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      <span>{online ? "Conectado e sincronizando" : "Sem internet · usando dados do aparelho"}</span>
      {savedAt ? <span className="ml-auto text-[10px] opacity-70">{savedAt}</span> : null}
    </div>
  );
}
