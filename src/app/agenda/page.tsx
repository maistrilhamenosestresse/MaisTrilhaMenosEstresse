"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useCartStore } from "@/store/cartStore";

type Agenda = {
  id: string;
  title: string;
  date: string;
  price: number;
  images?: string[] | null;
  flyer_url?: string | null;
  meeting_point?: string | null;
  max_capacity?: number | null;
  reserved_count?: number;
  accepted_payment_methods?: string[] | null;
  taxa_gratis?: boolean;
  difficulty?: string | null;
};

function eventDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function monthKey(value: string) {
  const date = eventDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  return eventDate(value)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (letter) => letter.toUpperCase());
}

type AgendaCardProps = {
  agenda: Agenda;
  index: number;
  justAdded: boolean;
  onAdd: (agenda: Agenda, remaining: number) => void;
};

function AgendaCard({ agenda, index, justAdded, onAdd }: AgendaCardProps) {
  const date = eventDate(agenda.date);
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit" });
  const weekDay = date
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
  const occupied = Number(agenda.reserved_count || 0);
  const capacity = Number(agenda.max_capacity || 15);
  const remaining = Math.max(0, capacity - occupied);
  const full = remaining === 0;
  const imageUrl =
    agenda.flyer_url ||
    (Array.isArray(agenda.images) ? agenda.images[0] : null);

  return (
    <motion.article
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className={`group min-w-[82%] basis-[82%] shrink-0 snap-start overflow-hidden rounded-[1.35rem] border bg-[#182333] shadow-xl transition sm:min-w-[46%] sm:basis-[46%] md:min-w-[31%] md:basis-[31%] md:rounded-[1.75rem] lg:min-w-[23%] lg:basis-[23%] xl:min-w-[22%] xl:basis-[22%] ${
        full
          ? "border-white/5 opacity-60 grayscale"
          : "border-white/10 hover:-translate-y-1 hover:border-orange-300/30"
      }`}
    >
      <Link
        href={`/agenda/${agenda.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-slate-800"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Trilha ${agenda.title}`}
            fill
            sizes="(max-width: 639px) 82vw, (max-width: 767px) 46vw, (max-width: 1023px) 31vw, 23vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full place-items-center">
            <ImageIcon className="h-8 w-8 text-slate-600" />
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#182333] via-transparent to-black/15" />
        <div className="absolute left-2 top-2 overflow-hidden rounded-xl bg-white text-center text-[#0F1722] shadow-xl md:left-3 md:top-3">
          <span className="block bg-[#F17B37] px-2 py-0.5 text-[9px] font-black text-white">
            {weekDay}
          </span>
          <span className="block px-2 py-1 text-lg font-black leading-none md:text-xl">
            {day}
          </span>
        </div>
        {full && (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-red-600 px-2 py-1 text-center text-[9px] font-black uppercase tracking-wider">
            Esgotada
          </span>
        )}
      </Link>

      <div className="flex min-h-44 flex-col p-3 sm:p-4">
        <p className="line-clamp-2 min-h-10 text-xs font-black leading-snug text-white sm:text-sm">
          {agenda.title}
        </p>
        <div className="mt-2 space-y-1.5">
          <p className="flex items-start gap-1 text-[10px] leading-tight text-slate-400">
            <MapPin className="mt-px h-3 w-3 shrink-0 text-[#F17B37]" />
            <span className="line-clamp-1">
              {agenda.meeting_point || "Local a confirmar"}
            </span>
          </p>
          <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Users className="h-3 w-3 text-emerald-400" />
            {full ? "Sem vagas" : `${remaining} vagas`}
          </p>
        </div>

        <div className="mt-auto pt-3">
          <p className="text-sm font-black text-white sm:text-base">
            {formatCurrency(agenda.price)}
          </p>
          <div className="mt-2 flex gap-1.5">
            <Link
              href={`/agenda/${agenda.id}`}
              aria-label={`Ver detalhes de ${agenda.title}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onAdd(agenda, remaining)}
              disabled={full}
              className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 sm:text-xs ${
                justAdded
                  ? "bg-emerald-500 text-white"
                  : "bg-[#F17B37] text-white hover:bg-[#DD6828]"
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Adicionada
                </>
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5" /> Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

type MonthRailProps = {
  monthAgendas: Agenda[];
  addedAgendaId: string | null;
  onAdd: (agenda: Agenda, remaining: number) => void;
};

function MonthRail({ monthAgendas, addedAgendaId, onAdd }: MonthRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateScrollState = () => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      setCanScrollLeft(rail.scrollLeft > 8);
      setCanScrollRight(rail.scrollLeft < maxScroll - 8);
      setProgress(maxScroll > 0 ? rail.scrollLeft / maxScroll : 1);
    };

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(rail);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [monthAgendas.length]);

  function scrollRail(direction: "left" | "right") {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: (direction === "right" ? 1 : -1) * rail.clientWidth * 0.86,
      behavior: "smooth",
    });
  }

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div className="relative">
      <div
        ref={railRef}
        role="region"
        aria-label={`Trilhas de ${monthLabel(monthAgendas[0].date)}`}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-5 pt-1 scroll-smooth [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {monthAgendas.map((agenda, index) => (
          <AgendaCard
            key={agenda.id}
            agenda={agenda}
            index={index}
            justAdded={addedAgendaId === agenda.id}
            onAdd={onAdd}
          />
        ))}
        {hasOverflow && <div aria-hidden="true" className="w-3 shrink-0 sm:w-8" />}
      </div>

      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute inset-y-1 left-0 hidden w-20 bg-gradient-to-r from-[#0F1722] to-transparent md:block" />
          <button
            type="button"
            onClick={() => scrollRail("left")}
            aria-label="Ver trilhas anteriores"
            className="absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#071829]/90 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-[#F17B37] md:grid"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute inset-y-1 right-0 w-16 bg-gradient-to-l from-[#0F1722] to-transparent sm:w-24" />
          <button
            type="button"
            onClick={() => scrollRail("right")}
            aria-label="Ver mais trilhas deste mês"
            className="absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#071829]/90 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-[#F17B37] md:grid"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </>
      )}

      {hasOverflow && (
        <div className="mt-1 flex items-center justify-between gap-4 px-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 md:hidden">
            Deslize para ver mais <ArrowRight className="h-3.5 w-3.5 text-[#F17B37]" />
          </span>
          <div
            className="ml-auto h-1 w-20 overflow-hidden rounded-full bg-white/10 sm:w-28"
            aria-label={`${Math.round(progress * 100)}% da faixa visualizada`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-[#F17B37] transition-[width] duration-150"
              style={{ width: `${Math.max(18, progress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgendaCalendar() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addedAgendaId, setAddedAgendaId] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    async function fetchAgendas() {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("agendas")
        .select("*")
        .gte("date", today)
        .order("date", { ascending: true });

      if (error) {
        console.error("Erro ao buscar agendas:", error);
        setLoadError("Não foi possível carregar as trilhas. Tente novamente.");
        setIsLoading(false);
        return;
      }

      const availabilityResponse = await fetch("/api/agendas/availability", {
        cache: "no-store",
      });
      const availability = availabilityResponse.ok
        ? await availabilityResponse.json()
        : { reservedByAgenda: {} };

      setAgendas(
        (data || []).map((agenda) => ({
          ...agenda,
          reserved_count: availability.reservedByAgenda?.[agenda.id] || 0,
        })) as Agenda[],
      );
      setIsLoading(false);
    }

    fetchAgendas();
  }, []);

  const months = useMemo(() => {
    const grouped = new Map<string, Agenda[]>();
    for (const agenda of agendas) {
      const key = monthKey(agenda.date);
      grouped.set(key, [...(grouped.get(key) || []), agenda]);
    }
    return [...grouped.entries()];
  }, [agendas]);

  function addAgendaToCart(agenda: Agenda, remaining: number) {
    if (remaining <= 0) return;
    const imageUrl =
      agenda.flyer_url ||
      (Array.isArray(agenda.images) ? agenda.images[0] : null) ||
      null;
    addItem({
      agendaId: agenda.id,
      title: agenda.title,
      price: Number(agenda.price),
      date: agenda.date,
      imageUrl,
      difficulty: agenda.difficulty || null,
      quantity: 1,
      dependents: [],
      availableSpots: remaining,
      acceptedPaymentMethods:
        Array.isArray(agenda.accepted_payment_methods) &&
        agenda.accepted_payment_methods.length
          ? agenda.accepted_payment_methods
          : ["PIX"],
      taxa_gratis: agenda.taxa_gratis === true,
    });
    setAddedAgendaId(agenda.id);
    window.setTimeout(() => setAddedAgendaId(null), 1800);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F1722] pb-24 font-sans text-white selection:bg-[#F17B37]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#F17B37]/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#173D63]/30 blur-[140px]" />

      <header className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-28 sm:px-6 md:pb-10 md:pt-36">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-[#F17B37]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">
            <CalendarDays className="h-3.5 w-3.5" /> Calendário oficial
          </span>
          <div className="mt-5">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Próximas <span className="text-[#F17B37]">aventuras</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-lg">
                Compare datas lado a lado, monte seu roteiro e coloque várias trilhas no mesmo carrinho.
              </p>
            </div>
          </div>
        </motion.div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="aspect-[3/4] animate-pulse rounded-3xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-red-400/20 bg-red-500/10 py-16 text-center">
            <p className="font-bold text-red-200">{loadError}</p>
          </div>
        ) : months.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 py-16 text-center">
            <CalendarDays className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="font-bold text-slate-300">Nenhuma nova trilha publicada.</p>
            <p className="mt-2 text-sm text-slate-500">O calendário será atualizado em breve.</p>
          </div>
        ) : (
          <div className="space-y-10 md:space-y-14">
            {months.map(([key, monthAgendas]) => (
              <section key={key}>
                <div className="mb-4 flex items-center gap-3 px-1">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F17B37] text-[10px] font-black uppercase shadow-lg shadow-orange-950/30">
                    {eventDate(monthAgendas[0].date)
                      .toLocaleDateString("pt-BR", { month: "short" })
                      .replace(".", "")}
                  </span>
                  <div>
                    <h2 className="text-xl font-black capitalize md:text-2xl">
                      {monthLabel(monthAgendas[0].date)}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500">
                      {monthAgendas.length} {monthAgendas.length === 1 ? "experiência" : "experiências"}
                    </p>
                  </div>
                  <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                </div>

                <MonthRail
                  monthAgendas={monthAgendas}
                  addedAgendaId={addedAgendaId}
                  onAdd={addAgendaToCart}
                />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
