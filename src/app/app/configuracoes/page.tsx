"use client";

import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { PwaEngagementCard } from "@/components/app/PwaEngagementCard";

export default function AppSettingsPage() {
  const router = useRouter();

  return (
    <div className="mt-app-page min-h-full pb-24">
      <header className="mt-app-header sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0B2540] shadow-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">Preferências</p>
          <h1 className="text-lg font-black text-[#071829]">Configurações do aplicativo</h1>
        </div>
      </header>

      <main className="space-y-5 p-4 sm:p-6">
        <PwaEngagementCard />
        <div className="flex gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p className="text-xs leading-relaxed">
            Você escolhe se deseja receber avisos e pode desativá-los a qualquer momento.
            Não usamos notificações invisíveis nem compartilhamos sua inscrição com anunciantes.
          </p>
        </div>
      </main>
    </div>
  );
}
