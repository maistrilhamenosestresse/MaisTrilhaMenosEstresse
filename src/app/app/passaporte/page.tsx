"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, BookOpen, Check, ChevronRight, CircleHelp,
  Coins, Compass, Crown, Download, Footprints, Gift, History, Loader2, LockKeyhole,
  MapPinned, Medal, Mountain, Share2, ShieldCheck, Sparkles,
  Stamp, Star, Sunrise, TicketCheck, TreePine, Trophy, WalletCards, Waves, WifiOff, X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatOfflineUpdate, getOfflineData, saveOfflineData } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";
import { ADVENTURE_LEVELS } from "@/lib/gamification";
import {
  createPassportShareImage,
  createTrailStampShareImage,
  getTrailStampIdentity,
  shareOrDownloadImage,
  type TrailStampIdentity,
} from "@/lib/passport-share";

type TrailStamp = {
  id: string;
  title: string;
  date: string;
  distance_km: number | null;
  difficulty: string | null;
  flyer_url: string | null;
};

type ExperienceEntry = {
  id: string;
  experience: number;
  description: string;
  created_at: string;
};

type PassportData = {
  participant: {
    fullName: string;
    points: number;
    experience: number;
    cashbackBalance: number;
    passportNumber: string;
    issuedAt: string;
  };
  summary: {
    completedCount: number;
    totalDistanceKm: number;
    upcomingCount: number;
    nextMilestone: number;
    level: string;
    levelNumber: number;
    nextLevel: string | null;
    levelProgress: number;
    experienceRemaining: number;
  };
  completed: TrailStamp[];
  upcoming: TrailStamp[];
  experienceHistory: ExperienceEntry[];
  releasedCheckouts?: number;
};

type PassportPage = "identidade" | "vistos" | "diario";

const PAGE_TABS: Array<{ id: PassportPage; label: string; icon: typeof Stamp }> = [
  { id: "identidade", label: "Identidade", icon: ShieldCheck },
  { id: "vistos", label: "Vistos", icon: Stamp },
  { id: "diario", label: "Diário", icon: History },
];

const LEVEL_ICONS = [Footprints, Medal, Mountain, Compass, Crown, Trophy];
const STAMP_MOTIF_ICONS: Record<TrailStampIdentity["motif"], typeof Mountain> = {
  peak: Mountain,
  forest: TreePine,
  compass: Compass,
  river: Waves,
  sun: Sunrise,
  footprints: Footprints,
};
const SEAL_TIER_GUIDE: Array<{ label: TrailStampIdentity["rarityLabel"]; stars: number; note: string; color: string }> = [
  { label: "CLÁSSICO", stars: 1, note: "Até 11 km", color: "#8F302B" },
  { label: "RARO", stars: 2, note: "A partir de 12 km", color: "#174E67" },
  { label: "ÉPICO", stars: 3, note: "Longa ou difícil", color: "#9A571F" },
  { label: "LENDÁRIO", stars: 4, note: "Desafio extremo", color: "#192235" },
];

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(value.includes("T") ? value : `${value}T12:00:00Z`));

export default function TrailPassportPage() {
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [usingOfflineCopy, setUsingOfflineCopy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activePage, setActivePage] = useState<PassportPage>("identidade");
  const [selectedStamp, setSelectedStamp] = useState<TrailStamp | null>(null);
  const [sharingTarget, setSharingTarget] = useState<"passport" | string | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [shareError, setShareError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const online = useNetworkStatus();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshKey((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

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
        const response = await fetch(`/api/app/passport?refresh=${Date.now()}`, { cache: "no-store" });
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
  }, [online, refreshKey]);

  const sharePassport = async () => {
    if (!data || sharingTarget) return;
    setSharingTarget("passport");
    setShareNotice("");
    setShareError("");
    try {
      const file = await createPassportShareImage(data);
      const result = await shareOrDownloadImage(
        file,
        "Meu Passaporte de Trilhas",
        `Meu Passaporte Mais Trilha registra ${data.summary.completedCount} trilhas, ${data.summary.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km e o nível ${data.summary.level}.`,
      );
      if (result === "shared") setShareNotice("Passaporte compartilhado com sucesso.");
      if (result === "downloaded") setShareNotice("Imagem do Passaporte baixada neste aparelho.");
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : "Não foi possível gerar a imagem do Passaporte.");
    } finally {
      setSharingTarget(null);
    }
  };

  const shareTrailStamp = async (trail: TrailStamp) => {
    if (!data || sharingTarget) return;
    setSharingTarget(trail.id);
    setShareNotice("");
    setShareError("");
    try {
      const file = await createTrailStampShareImage(trail, data.participant.fullName);
      const result = await shareOrDownloadImage(
        file,
        `Carimbo da trilha ${trail.title}`,
        `Conquistei o carimbo oficial da trilha ${trail.title} no meu Passaporte Mais Trilha.`,
      );
      if (result === "shared") setShareNotice("Carimbo compartilhado com sucesso.");
      if (result === "downloaded") setShareNotice("Imagem do carimbo baixada neste aparelho.");
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : "Não foi possível gerar a imagem do carimbo.");
    } finally {
      setSharingTarget(null);
    }
  };

  if (!data && !error) {
    return <div className="mt-app-page flex min-h-full items-center justify-center bg-[#061526]"><Loader2 className="h-9 w-9 animate-spin text-[#D9B56D]" /></div>;
  }

  return (
    <div className="mt-app-page min-h-full overflow-hidden bg-[#061526] pb-10">
      <div className="fixed inset-0 pointer-events-none opacity-25 [background-image:radial-gradient(circle_at_20%_20%,#D9B56D_0,transparent_24%),radial-gradient(circle_at_80%_75%,#1C527D_0,transparent_28%)]" />

      <header className="relative z-20 flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black backdrop-blur"><ArrowLeft className="h-4 w-4" /> App</Link>
        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#D9B56D]">Arquivo de expedições</p>
        <button onClick={sharePassport} disabled={!data || sharingTarget === "passport"} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 disabled:opacity-50" aria-label="Gerar imagem do Passaporte para compartilhar">{sharingTarget === "passport" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}</button>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-4">
        {usingOfflineCopy ? (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-200/25 bg-amber-100/10 p-3 text-amber-100">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="text-xs font-black">Cópia de campo offline</p><p className="mt-0.5 text-[10px] opacity-70">Atualizada {savedAt ? formatOfflineUpdate(savedAt) : "neste aparelho"}</p></div>
          </div>
        ) : null}
        {data?.releasedCheckouts ? (
          <div className="mb-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs font-bold text-emerald-100">
            Um checkout abandonado foi encerrado e seus pontos reservados voltaram para a carteira.
          </div>
        ) : null}
        {shareNotice ? <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs font-bold text-emerald-100"><Check className="h-4 w-4 shrink-0" />{shareNotice}</div> : null}
        {shareError ? <div className="mb-3 rounded-2xl border border-red-300/25 bg-red-300/10 p-3 text-xs font-bold text-red-100">{shareError}</div> : null}
        {error ? <div className="rounded-3xl bg-white p-6 text-center font-bold text-red-600">{error}</div> : null}

        {data && !isOpen ? (
          <PassportCover data={data} onOpen={() => setIsOpen(true)} />
        ) : null}

        {data && isOpen ? (
          <motion.section
            initial={{ rotateY: -82, opacity: 0, scale: 0.92 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 17 }}
            className="origin-left overflow-hidden rounded-[1.6rem] border border-[#D9B56D]/35 bg-[#F4ECD8] shadow-[0_28px_70px_rgba(0,0,0,.45)]"
          >
            <div className="relative border-b border-[#B69B67]/35 bg-[#EDE1C4] px-3 pb-3 pt-4">
              <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(70,49,24,.06)_4px)]" />
              <div className="relative mb-3 flex items-center justify-between px-1">
                <div><p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#8B2E28]">Mais Trilha Menos Estresse</p><h1 className="font-serif text-lg font-black text-[#1C2A36]">Passaporte de Expedições</h1></div>
                <button onClick={() => setIsOpen(false)} className="rounded-full border border-[#8E7852]/30 p-2 text-[#604F35]" aria-label="Fechar passaporte"><X className="h-4 w-4" /></button>
              </div>
              <nav className="relative grid grid-cols-3 gap-1 rounded-xl bg-[#CDBE9E]/45 p-1" aria-label="Páginas do passaporte">
                {PAGE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activePage === tab.id;
                  return <button key={tab.id} onClick={() => setActivePage(tab.id)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-black transition ${active ? "bg-[#132B43] text-[#F3D391] shadow" : "text-[#66583F]"}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>;
                })}
              </nav>
            </div>

            <div className="relative min-h-[590px] bg-[#F8F1DE] p-4 text-[#26313A] [background-image:radial-gradient(rgba(91,70,38,.12)_0.7px,transparent_0.7px)] [background-size:5px_5px]">
              <div className="absolute bottom-0 left-1/2 top-0 w-px bg-gradient-to-b from-transparent via-[#9D855C]/15 to-transparent" />
              <AnimatePresence mode="wait">
                <motion.div key={activePage} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ duration: 0.22 }}>
                  {activePage === "identidade" ? <IdentityPage data={data} goToStamps={() => setActivePage("vistos")} onShare={sharePassport} isSharing={sharingTarget === "passport"} /> : null}
                  {activePage === "vistos" ? <StampsPage data={data} onStamp={setSelectedStamp} /> : null}
                  {activePage === "diario" ? <JournalPage data={data} /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
            <footer className="flex items-center justify-between border-t border-[#B69B67]/30 bg-[#EDE1C4] px-5 py-2.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#7A6746]">
              <span>{data.participant.passportNumber}</span><span>Documento digital verificável</span>
            </footer>
          </motion.section>
        ) : null}
      </main>

      <AnimatePresence>
        {selectedStamp ? <StampModal trail={selectedStamp} participantName={data?.participant.fullName || ""} onClose={() => setSelectedStamp(null)} onShare={() => shareTrailStamp(selectedStamp)} isSharing={sharingTarget === selectedStamp.id} /> : null}
      </AnimatePresence>
    </div>
  );
}

function PassportCover({ data, onOpen }: { data: PassportData; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      className="relative mx-auto mt-3 flex min-h-[660px] w-full flex-col overflow-hidden rounded-[1.8rem] border border-[#D9B56D]/45 bg-[linear-gradient(145deg,#0C2B48,#061625_75%)] p-7 text-left text-[#E7C77F] shadow-[0_32px_80px_rgba(0,0,0,.6),inset_0_0_0_2px_rgba(217,181,109,.08)]"
    >
      <div className="absolute inset-3 rounded-[1.35rem] border border-[#D9B56D]/25" />
      <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.06)_4px)]" />
      <div className="relative flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-[#D9B56D]/50"><AnimatedCompass className="h-6 w-6" /></div>
        <span className="font-mono text-[9px] tracking-[0.2em]">{data.participant.passportNumber}</span>
      </div>
      <div className="relative mt-20 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Mais Trilha</p>
        <div className="mx-auto my-7 grid h-32 w-32 place-items-center rounded-full border-2 border-[#D9B56D]/65 shadow-[0_0_35px_rgba(217,181,109,.12)]">
          <div className="grid h-24 w-24 place-items-center rounded-full border border-dashed border-[#D9B56D]/50"><Mountain className="h-14 w-14" /></div>
        </div>
        <h1 className="font-serif text-4xl font-black uppercase leading-[1.08] tracking-wide">Passaporte<br />de Trilhas</h1>
        <div className="mx-auto mt-6 h-px w-28 bg-[#D9B56D]/50" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#D9B56D]/75">{data.participant.fullName}</p>
      </div>
      <div className="relative mt-auto">
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <CoverMetric value={data.summary.completedCount} label="Vistos" />
          <CoverMetric value={`${data.summary.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`} label="Jornada" />
          <CoverMetric value={data.participant.experience} label="XP" />
        </div>
        <span className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D9B56D]/35 bg-[#D9B56D]/10 py-4 text-xs font-black uppercase tracking-[0.2em]">Abrir passaporte <BookOpen className="h-4 w-4" /></span>
      </div>
    </motion.button>
  );
}

function IdentityPage({ data, goToStamps, onShare, isSharing }: { data: PassportData; goToStamps: () => void; onShare: () => void; isSharing: boolean }) {
  return <div className="space-y-5">
    <PageHeading code="P.01" eyebrow="Identificação do aventureiro" title="Titular do passaporte" />
    <div className="relative overflow-hidden rounded-2xl border border-[#9B8256]/35 bg-[#FFF9E9]/80 p-4 shadow-sm">
      <div className="absolute -right-5 -top-5 rotate-12 rounded-full border-2 border-[#9B302C]/30 p-5 text-[#9B302C]/35"><Stamp className="h-12 w-12" /></div>
      <div className="grid grid-cols-[76px_1fr] gap-4">
        <div className="grid h-24 place-items-center rounded-xl bg-[#132B43] text-[#E7C77F]"><AnimatedCompass className="h-10 w-10" glow /></div>
        <dl className="min-w-0 space-y-2">
          <IdentityField label="Nome" value={data.participant.fullName} />
          <IdentityField label="Documento" value={data.participant.passportNumber} mono />
          <IdentityField label="Expedido" value={formatDate(data.participant.issuedAt)} />
        </dl>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-dashed border-[#9B8256]/30 pt-3">
        <div><p className="text-[8px] font-black uppercase tracking-widest text-[#7D6845]">Classificação</p><p className="mt-1 font-serif text-lg font-black text-[#132B43]">{data.summary.level}</p></div>
        <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#9B302C]/45 font-serif text-xl font-black text-[#9B302C]">L{data.summary.levelNumber}</span>
      </div>
    </div>

    <div className="rounded-2xl bg-[#132B43] p-4 text-white shadow-lg">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E7C77F]">Experiência vitalícia</p><p className="mt-1 text-3xl font-black">{data.participant.experience.toLocaleString("pt-BR")} <span className="text-sm text-[#E7C77F]">XP</span></p></div><Star className="h-8 w-8 fill-[#E7C77F] text-[#E7C77F]" /></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><motion.div initial={{ width: 0 }} animate={{ width: `${data.summary.levelProgress}%` }} transition={{ duration: 0.9 }} className="h-full rounded-full bg-[linear-gradient(90deg,#D9B56D,#F17B37)]" /></div>
      <p className="mt-2 text-[10px] text-blue-100/70">{data.summary.nextLevel ? `Faltam ${data.summary.experienceRemaining.toLocaleString("pt-BR")} XP para ${data.summary.nextLevel}.` : "Você alcançou o nível máximo deste passaporte."}</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <WalletCard icon={Coins} label="Pontos disponíveis" value={`${data.participant.points.toLocaleString("pt-BR")} pts`} note="Só desconto; não vira saldo" />
      <WalletCard icon={WalletCards} label="Saldo cashback" value={data.participant.cashbackBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} note="Disponível na carteira" />
    </div>

    <button onClick={onShare} disabled={isSharing} className="flex w-full items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#8B2E28,#B34D35)] p-4 text-left text-[#FFF5DA] shadow-lg disabled:opacity-60"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">{isSharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</span><span className="flex-1"><strong className="block text-sm">Gerar imagem do meu Passaporte</strong><span className="text-[10px] text-white/70">Pronta para compartilhar no WhatsApp, Instagram ou salvar.</span></span><Share2 className="h-5 w-5" /></button>

    <button onClick={goToStamps} className="flex w-full items-center gap-3 rounded-2xl border border-[#9B8256]/30 bg-[#FFF9E9] p-4 text-left"><span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-[#9B302C]/50 text-[#9B302C]"><Stamp className="h-5 w-5" /></span><span className="flex-1"><strong className="block text-sm text-[#132B43]">Folhear vistos e carimbos</strong><span className="text-[10px] text-[#7D6845]">Cada aventura concluída ganha uma marca oficial.</span></span><ChevronRight className="h-5 w-5 text-[#9B8256]" /></button>
  </div>;
}

function StampsPage({ data, onStamp }: { data: PassportData; onStamp: (trail: TrailStamp) => void }) {
  return <div className="space-y-6">
    <PageHeading code="P.02" eyebrow="Registro de travessias" title="Vistos conquistados" />
    <div className="rounded-2xl border border-[#9B8256]/30 bg-[#EDE1C4]/55 p-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#9B302C]" /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#604F35]">Coleção de selos especiais</p></div><div className="mt-3 grid grid-cols-2 gap-2">{SEAL_TIER_GUIDE.map((tier) => <div key={tier.label} className="rounded-xl border bg-[#FFF9E9]/75 p-2" style={{ borderColor: `${tier.color}40` }}><div className="flex items-center justify-between"><strong className="text-[8px] tracking-wider" style={{ color: tier.color }}>{tier.label}</strong><span className="text-[8px]" style={{ color: tier.color }}>{"★".repeat(tier.stars)}</span></div><p className="mt-1 text-[8px] text-[#7D6845]">{tier.note}</p></div>)}</div><p className="mt-2 text-[8px] leading-relaxed text-[#7D6845]">Distância e dificuldade definem a raridade. Nome e natureza da trilha definem o símbolo exclusivo.</p></div>
    {data.completed.length ? <div className="grid grid-cols-2 gap-3">{data.completed.map((trail, index) => <VisaStamp key={trail.id} trail={trail} number={index + 1} onClick={() => onStamp(trail)} />)}</div> : <div className="rounded-2xl border-2 border-dashed border-[#9B8256]/35 p-7 text-center"><MapPinned className="mx-auto h-10 w-10 text-[#9B8256]/45" /><h3 className="mt-3 font-serif text-lg font-black text-[#132B43]">Página aguardando o primeiro visto</h3><p className="mt-1 text-xs text-[#7D6845]">Quando uma trilha paga for concluída, o carimbo aparecerá aqui.</p></div>}

    <div>
      <div className="mb-3 flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#9B302C]">Autorizações de embarque</p><h3 className="font-serif text-lg font-black text-[#132B43]">Próximas expedições</h3></div><span className="rounded-full bg-[#132B43] px-2.5 py-1 text-[10px] font-black text-[#F3D391]">{data.upcoming.length}</span></div>
      {data.upcoming.length ? <div className="space-y-2">{data.upcoming.map((trail) => <Link href={`/app/trilhas/${trail.id}`} key={trail.id} className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-[#9B8256]/30 bg-[#FFF9E9] p-3"><span className="absolute bottom-0 left-16 top-0 border-l border-dashed border-[#9B8256]/30" /><span className="grid h-10 w-10 shrink-0 place-items-center text-[#9B302C]"><TicketCheck className="h-6 w-6" /></span><span className="ml-3 min-w-0 flex-1"><strong className="block truncate text-xs text-[#132B43]">{trail.title}</strong><span className="text-[9px] font-bold uppercase tracking-wide text-[#7D6845]">Embarque {formatDate(trail.date)}</span></span><ChevronRight className="h-4 w-4 text-[#9B8256]" /></Link>)}</div> : <p className="rounded-xl bg-[#E8DDC4]/55 p-4 text-center text-xs text-[#7D6845]">Nenhuma próxima expedição paga.</p>}
    </div>
  </div>;
}

function JournalPage({ data }: { data: PassportData }) {
  return <div className="space-y-6">
    <PageHeading code="P.03" eyebrow="Diário do explorador" title="Evolução da jornada" />
    <div className="rounded-2xl border border-[#9B8256]/30 bg-[#FFF9E9]/80 p-4">
      <div className="flex items-center gap-3"><Trophy className="h-6 w-6 text-[#9B302C]" /><div><p className="text-[8px] font-black uppercase tracking-widest text-[#7D6845]">Próximo marco de coleção</p><h3 className="font-serif text-lg font-black text-[#132B43]">{data.summary.nextMilestone} trilhas concluídas</h3></div></div>
      <div className="mt-4 grid grid-cols-6 gap-1.5">{ADVENTURE_LEVELS.map((level, index) => { const Icon = LEVEL_ICONS[index]; const unlocked = data.participant.experience >= level.minExperience; return <div key={level.name} className={`rounded-lg p-2 text-center ${unlocked ? "bg-[#132B43] text-[#F3D391]" : "bg-[#E8DDC4] text-[#8B795A]/45"}`}><Icon className="mx-auto h-4 w-4" /><p className="mt-1 text-[7px] font-black">{level.minExperience >= 1000 ? `${level.minExperience / 1000}k` : level.minExperience}</p></div>; })}</div>
    </div>

    <div>
      <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-black text-[#132B43]"><History className="h-5 w-5 text-[#9B302C]" /> Últimos registros de XP</h3>
      {data.experienceHistory.length ? <div className="space-y-3 border-l border-[#9B8256]/35 pl-4">{data.experienceHistory.map((entry) => <div key={entry.id} className="relative"><span className="absolute -left-[1.28rem] top-1.5 h-2 w-2 rounded-full bg-[#9B302C] ring-4 ring-[#F8F1DE]" /><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#26313A]">{cleanExperienceDescription(entry.description)}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-[#8B795A]">{formatDate(entry.created_at)}</p></div><strong className={entry.experience >= 0 ? "text-emerald-700" : "text-red-700"}>{entry.experience > 0 ? "+" : ""}{entry.experience} XP</strong></div></div>)}</div> : <p className="rounded-xl bg-[#E8DDC4]/55 p-4 text-center text-xs text-[#7D6845]">Seu diário de experiência começará na próxima conquista.</p>}
    </div>

    <details className="group rounded-2xl border border-[#9B8256]/30 bg-[#FFF9E9]/75 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-3"><CircleHelp className="h-5 w-5 text-[#9B302C]" /><span className="flex-1 text-sm font-black text-[#132B43]">Como funciona?</span><ChevronRight className="h-4 w-4 transition group-open:rotate-90" /></summary>
      <div className="mt-4 space-y-3 border-t border-dashed border-[#9B8256]/30 pt-4"><HowRow number="01" title="Compre ou confirme" text="Uma venda paga gera pontos e XP conforme o valor válido." /><HowRow number="02" title="Use seus pontos" text="Pontos viram desconto; seu XP e seu nível permanecem." /><HowRow number="03" title="Conclua a aventura" text="Após a data da trilha, o visto entra na coleção do passaporte." /></div>
    </details>

    <div className="rounded-2xl bg-[linear-gradient(135deg,#762C27,#9B302C)] p-4 text-[#FFF1D2] shadow-lg"><div className="flex items-center gap-2"><Gift className="h-5 w-5" /><h3 className="font-serif text-lg font-black">Recompensas de fronteira</h3><span className="ml-auto rounded-full bg-white/10 px-2 py-1 text-[8px] font-black uppercase">Em breve</span></div><p className="mt-2 text-xs leading-relaxed opacity-75">Desafios sazonais, vistos raros e benefícios exclusivos serão liberados conforme sua classificação.</p><div className="mt-3 flex gap-2 text-[9px] font-black uppercase"><span className="rounded-lg bg-black/10 px-2 py-2"><LockKeyhole className="mr-1 inline h-3 w-3" /> Vagas antecipadas</span><span className="rounded-lg bg-black/10 px-2 py-2"><Sparkles className="mr-1 inline h-3 w-3" /> Selos especiais</span></div></div>
  </div>;
}

function VisaStamp({ trail, number, onClick }: { trail: TrailStamp; number: number; onClick: () => void }) {
  const identity = getTrailStampIdentity(trail);
  const Icon = STAMP_MOTIF_ICONS[identity.motif];
  const ringStyle = identity.ringStyle === "dashed" ? "border-dashed" : identity.ringStyle === "double" ? "border-double border-[5px]" : "border-[3px]";
  return <button onClick={onClick} className="relative min-h-56 overflow-hidden rounded-xl border p-3 text-center transition active:scale-[0.98]" style={{ backgroundColor: identity.paper, borderColor: `${identity.softInk}88`, boxShadow: identity.rarity === "legendary" ? `0 10px 30px ${identity.softInk}55, inset 0 0 0 1px ${identity.ink}33` : `0 5px 16px ${identity.ink}18` }}><div className="absolute inset-0 bg-cover bg-center opacity-[0.08] grayscale" style={trail.flyer_url ? { backgroundImage: `url(${trail.flyer_url})` } : undefined} /><span className="absolute left-3 top-3 font-mono text-[7px] font-black" style={{ color: identity.ink }}>VISTO {String(number).padStart(2, "0")}</span><span className="absolute right-2 top-2 rounded-full border bg-white/65 px-1.5 py-1 text-[6px] font-black tracking-wider" style={{ borderColor: identity.softInk, color: identity.ink }}>{identity.rarityLabel} {"★".repeat(identity.stars)}</span><div className={`relative mx-auto mt-3 grid h-28 w-28 place-items-center rounded-full ${ringStyle}`} style={{ borderColor: identity.ink, color: identity.ink, transform: `rotate(${identity.rotation}deg)` }}><div className="grid h-[5.7rem] w-[5.7rem] place-items-center rounded-full border border-dashed" style={{ borderColor: identity.softInk }}><div><span className="block text-[6px] font-black uppercase tracking-[0.14em]">{identity.motto}</span><Icon className="mx-auto my-1 h-8 w-8" /><span className="block font-mono text-[7px] font-black">{identity.serial}</span></div></div></div><p className="relative mt-3 line-clamp-2 font-serif text-sm font-black leading-tight text-[#132B43]">{trail.title}</p><p className="relative mt-1 text-[8px] font-black uppercase tracking-wider text-[#8B795A]">{formatDate(trail.date)}</p><span className="relative mt-2 inline-flex items-center gap-1 text-[8px] font-black uppercase" style={{ color: identity.ink }}><Share2 className="h-3 w-3" /> Abrir selo</span></button>;
}

function StampModal({ trail, participantName, onClose, onShare, isSharing }: { trail: TrailStamp; participantName: string; onClose: () => void; onShare: () => void; isSharing: boolean }) {
  const identity = getTrailStampIdentity(trail);
  const Icon = STAMP_MOTIF_ICONS[identity.motif];
  const ringStyle = identity.ringStyle === "dashed" ? "border-dashed" : identity.ringStyle === "double" ? "border-double border-[6px]" : "border-[4px]";
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] flex items-end bg-[#020A12]/80 p-4 backdrop-blur-md" onClick={onClose}><motion.article initial={{ y: 80, rotate: -2 }} animate={{ y: 0, rotate: 0 }} exit={{ y: 80 }} className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border shadow-2xl" style={{ backgroundColor: identity.paper, borderColor: identity.softInk, boxShadow: identity.rarity === "legendary" ? `0 0 60px ${identity.softInk}55` : undefined }} onClick={(event) => event.stopPropagation()}>{trail.flyer_url ? <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(0deg,${identity.ink}CC,transparent),url(${trail.flyer_url})` }} /> : <div className="grid h-28 place-items-center bg-[#132B43]"><Mountain className="h-12 w-12 text-[#D9B56D]" /></div>}<div className="relative p-5 text-[#26313A]"><div className={`absolute -right-1 -top-16 grid h-32 w-32 place-items-center rounded-full bg-[#F8F1DE] ${ringStyle}`} style={{ borderColor: identity.ink, color: identity.ink, transform: `rotate(${identity.rotation}deg)` }}><div className="grid h-[6.4rem] w-[6.4rem] place-items-center rounded-full border border-dashed text-center" style={{ borderColor: identity.softInk }}><div><span className="block text-[7px] font-black uppercase tracking-wider">{identity.motto}</span><Icon className="mx-auto my-1 h-9 w-9" /><span className="block font-mono text-[7px] font-black">{identity.serial}</span></div></div></div><div className="flex max-w-[66%] flex-wrap items-center gap-1.5"><span className="rounded-full px-2 py-1 text-[8px] font-black tracking-wider text-white" style={{ backgroundColor: identity.ink }}>SELO {identity.rarityLabel}</span><span className="text-[10px]" style={{ color: identity.softInk }}>{"★".repeat(identity.stars)}</span></div><p className="mt-2 text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: identity.ink }}>{identity.finish}</p><h2 className="mt-2 max-w-[68%] font-serif text-2xl font-black text-[#132B43]">{trail.title}</h2><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-[#7D6845]">Conquistado por {participantName}</p><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-[#66583F]"><span className="rounded-full border border-[#9B8256]/30 px-3 py-2">{formatDate(trail.date)}</span>{trail.distance_km ? <span className="rounded-full border border-[#9B8256]/30 px-3 py-2">{trail.distance_km} km</span> : null}{trail.difficulty ? <span className="rounded-full border border-[#9B8256]/30 px-3 py-2">{trail.difficulty}</span> : null}</div><button onClick={onShare} disabled={isSharing} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-60" style={{ backgroundColor: identity.ink }}>{isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}{isSharing ? "Gerando imagem..." : "Compartilhar meu selo"}</button><button onClick={onClose} className="mt-2 w-full rounded-xl border border-[#132B43]/15 py-3 text-xs font-black text-[#132B43]">Guardar no Passaporte</button></div></motion.article></motion.div>;
}

function AnimatedCompass({ className, glow = false }: { className: string; glow?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <span className="relative inline-grid place-items-center" aria-hidden="true">{glow ? <motion.span className="absolute h-[135%] w-[135%] rounded-full border border-current" animate={reduceMotion ? undefined : { opacity: [0, 0.38, 0], scale: [0.72, 1.18, 1.32] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeOut" }} /> : null}<motion.span className="inline-grid place-items-center drop-shadow-[0_0_8px_currentColor]" animate={reduceMotion ? undefined : { rotate: [0, 14, -9, 6, 0] }} transition={{ duration: 4.8, repeat: Infinity, repeatDelay: 0.7, ease: "easeInOut" }}><Compass className={className} /></motion.span></span>;
}

function PageHeading({ code, eyebrow, title }: { code: string; eyebrow: string; title: string }) { return <div className="flex items-end justify-between border-b border-[#9B8256]/30 pb-3"><div><p className="text-[8px] font-black uppercase tracking-[0.24em] text-[#9B302C]">{eyebrow}</p><h2 className="mt-1 font-serif text-2xl font-black text-[#132B43]">{title}</h2></div><span className="font-mono text-[9px] font-black text-[#8B795A]">{code}</span></div>; }
function CoverMetric({ value, label }: { value: string | number; label: string }) { return <div className="rounded-lg border border-[#D9B56D]/20 bg-black/10 p-2"><strong className="block text-sm">{value}</strong><span className="text-[7px] font-black uppercase tracking-wider opacity-60">{label}</span></div>; }
function IdentityField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-[7px] font-black uppercase tracking-[0.18em] text-[#8B795A]">{label}</dt><dd className={`truncate text-xs font-black text-[#26313A] ${mono ? "font-mono tracking-wider" : ""}`}>{value}</dd></div>; }
function WalletCard({ icon: Icon, label, value, note }: { icon: typeof Coins; label: string; value: string; note: string }) { return <div className="rounded-2xl border border-[#9B8256]/30 bg-[#EDE1C4]/65 p-3"><Icon className="h-5 w-5 text-[#9B302C]" /><p className="mt-2 text-[8px] font-black uppercase tracking-wider text-[#7D6845]">{label}</p><p className="mt-1 text-sm font-black text-[#132B43]">{value}</p><p className="mt-0.5 text-[8px] text-[#8B795A]">{note}</p></div>; }
function HowRow({ number, title, text }: { number: string; title: string; text: string }) { return <div className="flex gap-3"><span className="font-mono text-xs font-black text-[#9B302C]">{number}</span><div><strong className="text-xs text-[#132B43]">{title}</strong><p className="mt-0.5 text-[10px] leading-relaxed text-[#7D6845]">{text}</p></div></div>; }
function cleanExperienceDescription(value: string) { return value.replace(/ · ajuste [a-f0-9]+$/i, "").replace(" (retroativo)", ""); }
