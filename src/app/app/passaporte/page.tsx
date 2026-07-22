"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  Coins, Crown, Footprints, Gift, Loader2, LockKeyhole, MapPinned, Medal,
  Mountain, Route, Share2, Sparkles, Stamp, Trophy, WalletCards, WifiOff,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatOfflineUpdate, getOfflineData, saveOfflineData } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";

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
  summary: { completedCount: number; totalDistanceKm: number; upcomingCount: number; nextMilestone: number };
  completed: TrailStamp[];
  upcoming: TrailStamp[];
};

const LEVELS = [
  { count: 0, name: "Primeiros Passos", icon: Footprints },
  { count: 3, name: "Caminhante", icon: Medal },
  { count: 6, name: "Explorador", icon: Mountain },
  { count: 12, name: "Guardião", icon: Crown },
];

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(`${value}T12:00:00Z`));

export default function TrailPassportPage() {
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [usingOfflineCopy, setUsingOfflineCopy] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<TrailStamp | null>(null);
  const online = useNetworkStatus();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) return;

      const cached = getOfflineData<PassportData>(userId, "passport");
      if (cached && active) {
        setData(cached.data);
        setSavedAt(cached.savedAt);
        setUsingOfflineCopy(!navigator.onLine);
      }

      if (!navigator.onLine) {
        if (!cached && active) setError("Abra o passaporte uma vez com internet para deixá-lo disponível offline.");
        return;
      }

      try {
        const response = await fetch("/api/app/passport", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha ao abrir o passaporte");
        if (!active) return;
        setData(result);
        setError("");
        setUsingOfflineCopy(false);
        const now = new Date().toISOString();
        setSavedAt(now);
        saveOfflineData(userId, "passport", result);
      } catch (reason) {
        if (!cached && active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o passaporte.");
        if (cached && active) setUsingOfflineCopy(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [online]);

  const level = useMemo(() => {
    const count = data?.summary.completedCount || 0;
    return [...LEVELS].reverse().find((item) => count >= item.count) || LEVELS[0];
  }, [data]);

  const previousMilestone = Math.max(0, (data?.summary.nextMilestone || 3) - 3);
  const milestoneProgress = data
    ? Math.min(100, ((data.summary.completedCount - previousMilestone) / 3) * 100)
    : 0;

  const sharePassport = async () => {
    if (!data) return;
    const text = `Já completei ${data.summary.completedCount} trilhas e percorri ${data.summary.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km com a Mais Trilha Menos Estresse!`;
    if (navigator.share) await navigator.share({ title: "Meu Passaporte de Trilhas", text });
    else await navigator.clipboard.writeText(text);
  };

  if (!data && !error) {
    return <div className="mt-app-page flex min-h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#D96224]" /></div>;
  }

  return (
    <div className="mt-app-page min-h-full bg-[#F4F7FA] pb-12">
      <header className="relative overflow-hidden rounded-b-[2.5rem] bg-[linear-gradient(145deg,#061526,#0B2540_68%,#12385E)] px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-white">
        <div className="absolute -right-16 top-0 h-52 w-52 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative">
          <div className="mb-7 flex items-center justify-between">
            <Link href="/app" className="inline-flex items-center gap-2 text-sm font-bold text-blue-100"><ArrowLeft className="h-5 w-5" /> Voltar</Link>
            <button onClick={sharePassport} disabled={!data} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10" aria-label="Compartilhar conquista"><Share2 className="h-4 w-4" /></button>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-200">Sua história na natureza</p>
              <h1 className="mt-2 text-3xl font-black leading-tight">Passaporte<br />de Trilhas</h1>
              <p className="mt-2 text-sm text-blue-100/75">{data?.participant.fullName || "Aventureiro"}</p>
            </div>
            <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-[1.6rem] border border-white/15 bg-white/10 shadow-xl backdrop-blur">
              <Stamp className="h-10 w-10 text-orange-200" />
              <span className="absolute -bottom-2 rounded-full bg-[#F17B37] px-2 py-1 text-[9px] font-black">MT</span>
            </div>
          </div>
          {data ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <level.icon className="h-6 w-6 text-orange-200" />
              <div><p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/55">Nível atual</p><strong className="text-sm text-orange-100">{level.name}</strong></div>
              <span className="ml-auto rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black text-emerald-200">ATIVO</span>
            </div>
          ) : null}
        </div>
      </header>

      <main className="space-y-6 px-4 pt-5 sm:px-6">
        {usingOfflineCopy ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-xs font-black">Passaporte disponível offline</p><p className="mt-0.5 text-[10px] opacity-70">Última atualização: {savedAt ? formatOfflineUpdate(savedAt) : "salva no aparelho"}</p></div>
          </div>
        ) : null}

        {error ? <section className="rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm"><p className="font-bold text-red-600">{error}</p></section> : null}

        {data ? <>
          <section className="grid grid-cols-3 gap-2">
            <Metric icon={Mountain} value={data.summary.completedCount} label="Concluídas" />
            <Metric icon={Route} value={`${data.summary.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`} label="Percorridos" />
            <Metric icon={CalendarDays} value={data.summary.upcomingCount} label="Agendadas" />
          </section>

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <button onClick={() => setHowItWorksOpen((value) => !value)} className="flex w-full items-center gap-3 p-5 text-left">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E7EEF6] text-[#0B2540]"><CircleHelp className="h-5 w-5" /></span>
              <span className="flex-1"><strong className="block text-sm text-[#071829]">Como funciona o passaporte?</strong><span className="mt-0.5 block text-xs text-slate-500">Entenda selos, níveis e recompensas</span></span>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${howItWorksOpen ? "rotate-180" : ""}`} />
            </button>
            {howItWorksOpen ? (
              <div className="grid gap-3 border-t border-slate-100 p-5 pt-4">
                <HowStep number="1" title="Participe" text="Sua reserva paga aparece automaticamente no aplicativo." />
                <HowStep number="2" title="Conclua e colecione" text="Após a data da aventura, a trilha vira um selo no passaporte." />
                <HowStep number="3" title="Evolua" text="A cada marco você sobe de nível e acompanha novas conquistas." />
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#071829,#12385E)] p-5 text-white shadow-xl">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-400/15 text-orange-200"><Trophy className="h-6 w-6" /></div>
              <div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">Próximo marco</p><h2 className="mt-1 text-lg font-black">{data.summary.nextMilestone} trilhas concluídas</h2><p className="mt-1 text-xs text-blue-100/70">Faltam {Math.max(0, data.summary.nextMilestone - data.summary.completedCount)} aventuras.</p></div>
              <strong className="text-xl text-orange-200">{Math.round(milestoneProgress)}%</strong>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#F17B37,#FDBA74)] transition-all duration-700" style={{ width: `${milestoneProgress}%` }} /></div>
            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {LEVELS.map((item) => {
                const unlocked = data.summary.completedCount >= item.count;
                const Icon = item.icon;
                return <div key={item.name} className={`rounded-xl p-2 text-center ${unlocked ? "bg-white/10" : "bg-black/10 opacity-45"}`}><Icon className={`mx-auto h-4 w-4 ${unlocked ? "text-orange-200" : "text-white/60"}`} /><p className="mt-1 truncate text-[8px] font-bold">{item.count || "Início"}</p></div>;
              })}
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Sua coleção" title="Selos conquistados" count={data.completed.length} />
            {data.completed.length ? (
              <div className="grid grid-cols-2 gap-3">
                {data.completed.map((trail, index) => <StampCard key={trail.id} trail={trail} number={index + 1} onOpen={() => setSelectedStamp(trail)} />)}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-7 text-center"><MapPinned className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-black text-slate-800">Seu primeiro selo está esperando</h3><p className="mt-1 text-sm text-slate-500">Conclua uma trilha para inaugurar o passaporte.</p></div>
            )}
          </section>

          {data.upcoming.length ? (
            <section><SectionTitle eyebrow="Próximos carimbos" title="Aventuras agendadas" count={data.upcoming.length} /><div className="space-y-2">{data.upcoming.map((trail) => <Link href={`/app/trilhas/${trail.id}`} key={trail.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-[#D96224]"><CalendarDays className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#071829]">{trail.title}</strong><span className="text-[11px] font-bold text-slate-500">{formatDate(trail.date)}</span></span><ChevronRight className="h-5 w-5 text-slate-300" /></Link>)}</div></section>
          ) : null}

          <section className="grid grid-cols-2 gap-3">
            <ValueCard icon={Coins} label="Pontos" value={`${data.participant.points.toLocaleString("pt-BR")} pts`} color="amber" />
            <ValueCard icon={WalletCards} label="Cashback" value={data.participant.cashbackBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} color="emerald" />
          </section>

          <section className="rounded-[1.75rem] border border-amber-200 bg-[linear-gradient(145deg,#FFF9E8,#FFF3D0)] p-5"><div className="flex items-center gap-2 text-amber-800"><Sparkles className="h-5 w-5" /><h2 className="font-black">Clube Mais Trilha</h2><span className="ml-auto rounded-full bg-amber-200/70 px-2 py-1 text-[9px] font-black uppercase">Em breve</span></div><p className="mt-3 text-sm leading-relaxed text-amber-950/70">Desafios, selos especiais e benefícios para transformar cada aventura em uma nova conquista.</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-amber-950/80"><span className="flex items-center gap-2 rounded-xl bg-white/60 p-3"><LockKeyhole className="h-4 w-4" /> Vagas antecipadas</span><span className="flex items-center gap-2 rounded-xl bg-white/60 p-3"><Gift className="h-4 w-4" /> Recompensas</span></div></section>
        </> : null}
      </main>

      {/* A origem da imagem pode ser uma URL histórica fora dos domínios otimizados pelo Next. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {selectedStamp ? <div className="fixed inset-0 z-[210] flex items-end bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setSelectedStamp(null)}><article className="w-full rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>{selectedStamp.flyer_url ? <img src={selectedStamp.flyer_url} alt="" className="mb-4 h-44 w-full rounded-2xl object-cover" /> : null}<div className="flex items-center gap-2 text-emerald-700"><Check className="h-4 w-4" /><span className="text-xs font-black uppercase">Selo conquistado</span></div><h2 className="mt-2 text-xl font-black text-[#071829]">{selectedStamp.title}</h2><div className="mt-4 flex gap-2 text-xs font-bold text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-2">{formatDate(selectedStamp.date)}</span>{selectedStamp.distance_km ? <span className="rounded-full bg-slate-100 px-3 py-2">{selectedStamp.distance_km} km</span> : null}</div><button onClick={() => setSelectedStamp(null)} className="mt-5 w-full rounded-2xl bg-[#0B2540] py-3.5 text-sm font-black text-white">Guardar no passaporte</button></article></div> : null}
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Mountain; value: string | number; label: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"><Icon className="mx-auto h-5 w-5 text-[#D96224]" /><p className="mt-2 truncate text-sm font-black text-[#071829]">{value}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p></div>;
}

function HowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF0E6] text-xs font-black text-[#D96224]">{number}</span><div><strong className="text-sm text-[#071829]">{title}</strong><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p></div></div>;
}

function SectionTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) {
  return <div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D96224]">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-[#071829]">{title}</h2></div><span className="rounded-full bg-[#E7EEF6] px-3 py-1 text-xs font-black text-[#0B2540]">{count}</span></div>;
}

function StampCard({ trail, number, onOpen }: { trail: TrailStamp; number: number; onOpen: () => void }) {
  return <button onClick={onOpen} className="group relative min-h-56 overflow-hidden rounded-[1.5rem] bg-[#0B2540] text-left shadow-md"><div className="absolute inset-0 bg-cover bg-center opacity-55 transition-transform duration-500 group-active:scale-105" style={trail.flyer_url ? { backgroundImage: `url(${trail.flyer_url})` } : undefined} /><div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(5,20,36,.95))]" /><div className="relative flex h-full min-h-56 flex-col p-4"><div className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-orange-200 bg-[#D96224]/85 text-sm font-black text-white">{String(number).padStart(2, "0")}</div><div className="mt-auto"><p className="mb-1 text-[9px] font-black uppercase tracking-wider text-orange-200">Selo oficial</p><h3 className="line-clamp-2 text-sm font-black leading-tight text-white">{trail.title}</h3><p className="mt-2 text-[10px] font-bold text-blue-100/75">{formatDate(trail.date)}</p></div></div></button>;
}

function ValueCard({ icon: Icon, label, value, color }: { icon: typeof Coins; label: string; value: string; color: "amber" | "emerald" }) {
  return <div className={`rounded-2xl border p-4 ${color === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><Icon className="h-5 w-5" /><p className="mt-3 text-[9px] font-black uppercase tracking-wider opacity-60">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}
