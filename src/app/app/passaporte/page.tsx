"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  LockKeyhole,
  MapPinned,
  Medal,
  Mountain,
  Route,
  Sparkles,
  Stamp,
} from "lucide-react";

type TrailStamp = {
  id: string;
  title: string;
  date: string;
  distance_km: number | null;
  difficulty: string | null;
  flyer_url: string | null;
};

type PassportData = {
  participant: { fullName: string; points: number; cashbackBalance: number };
  summary: {
    completedCount: number;
    totalDistanceKm: number;
    upcomingCount: number;
    nextMilestone: number;
  };
  completed: TrailStamp[];
  upcoming: TrailStamp[];
};

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}T12:00:00Z`));

export default function TrailPassportPage() {
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/app/passport", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha ao abrir o passaporte");
        setData(result);
      })
      .catch((reason) => setError(reason.message || "Não foi possível carregar o passaporte."));
  }, []);

  const level = useMemo(() => {
    const count = data?.summary.completedCount || 0;
    if (count >= 12) return { name: "Guardião das Trilhas", color: "text-amber-300" };
    if (count >= 6) return { name: "Explorador", color: "text-cyan-200" };
    if (count >= 3) return { name: "Caminhante", color: "text-orange-200" };
    return { name: "Primeiros Passos", color: "text-blue-200" };
  }, [data]);

  if (!data && !error) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  return (
    <div className="mt-app-page min-h-full bg-[#F4F7FA] pb-10">
      <header className="relative overflow-hidden rounded-b-[2.25rem] bg-[linear-gradient(145deg,#061526,#0B2540_68%,#12385E)] px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-white">
        <div className="absolute -right-16 top-0 h-52 w-52 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative">
          <Link href="/app" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-blue-100">
            <ArrowLeft className="h-5 w-5" /> Voltar
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-200">Documento de aventura</p>
              <h1 className="mt-2 text-3xl font-black">Passaporte de Trilhas</h1>
              <p className="mt-2 text-sm text-blue-100/75">{data?.participant.fullName || "Aventureiro"}</p>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-xl backdrop-blur">
              <Stamp className="h-8 w-8 text-orange-200" />
            </div>
          </div>
          {data ? (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <Medal className={`h-5 w-5 ${level.color}`} />
              <span className="text-xs text-blue-100/70">Nível atual</span>
              <strong className={`ml-auto text-sm ${level.color}`}>{level.name}</strong>
            </div>
          ) : null}
        </div>
      </header>

      <main className="-mt-1 space-y-7 px-4 pt-6 sm:px-6">
        {error ? (
          <section className="rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm">
            <p className="font-bold text-red-600">{error}</p>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-3 gap-2">
              <Metric icon={Mountain} value={data.summary.completedCount} label="Concluídas" />
              <Metric icon={Route} value={`${data.summary.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`} label="Percorridos" />
              <Metric icon={CalendarDays} value={data.summary.upcomingCount} label="Agendadas" />
            </section>

            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D96224]">Sua história</p>
                  <h2 className="mt-1 text-xl font-black text-[#071829]">Selos conquistados</h2>
                </div>
                <span className="rounded-full bg-[#E7EEF6] px-3 py-1 text-xs font-black text-[#0B2540]">
                  {data.completed.length}
                </span>
              </div>

              {data.completed.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {data.completed.map((trail, index) => (
                    <article key={trail.id} className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-orange-50" />
                      <div className="relative">
                        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border-2 border-dashed border-[#D96224] bg-orange-50 text-[#D96224]">
                          <span className="text-sm font-black">{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-tight text-[#071829]">{trail.title}</h3>
                        <p className="mt-2 text-[11px] font-bold text-slate-500">{formatDate(trail.date)}</p>
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Concluída
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-7 text-center">
                  <MapPinned className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-3 font-black text-slate-800">Seu primeiro selo está esperando</h3>
                  <p className="mt-1 text-sm text-slate-500">Conclua uma trilha para inaugurar o passaporte.</p>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#071829,#12385E)] p-5 text-white shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-400/15 text-orange-200">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">Próxima conquista</p>
                  <h2 className="mt-1 text-lg font-black">Selo de {data.summary.nextMilestone} trilhas</h2>
                  <p className="mt-1 text-xs leading-relaxed text-blue-100/70">
                    Faltam {Math.max(0, data.summary.nextMilestone - data.summary.completedCount)} aventuras para desbloquear este marco.
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#F17B37,#FDBA74)]"
                  style={{ width: `${Math.min(100, (data.summary.completedCount / data.summary.nextMilestone) * 100)}%` }}
                />
              </div>
              <Link href="/app/trilhas" className="mt-5 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#071829]">
                Escolher a próxima trilha <ChevronRight className="h-5 w-5 text-[#D96224]" />
              </Link>
            </section>

            <section className="rounded-[1.75rem] border border-amber-200 bg-[linear-gradient(145deg,#FFF9E8,#FFF3D0)] p-5">
              <div className="flex items-center gap-2 text-amber-800">
                <Sparkles className="h-5 w-5" />
                <h2 className="font-black">Clube Mais Trilha</h2>
                <span className="ml-auto rounded-full bg-amber-200/70 px-2 py-1 text-[9px] font-black uppercase">Em breve</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-amber-950/70">
                Estamos preparando desafios exclusivos, acesso antecipado a vagas, selos especiais e recursos avançados de navegação.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-amber-950/80">
                <span className="flex items-center gap-2 rounded-xl bg-white/60 p-3"><LockKeyhole className="h-4 w-4" /> Vagas antecipadas</span>
                <span className="flex items-center gap-2 rounded-xl bg-white/60 p-3"><Medal className="h-4 w-4" /> Desafios especiais</span>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Mountain;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <Icon className="mx-auto h-5 w-5 text-[#D96224]" />
      <p className="mt-2 truncate text-sm font-black text-[#071829]">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
