"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Images,
  Loader2,
  MapPin,
  Mountain,
  Play,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TicketCheck,
  WalletCards,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useCartStore } from "@/store/cartStore";

type TrailForCart = {
  id: string;
  title: string;
  date: string;
  price: number;
  description: string | null;
  difficulty: string | null;
  duration_hours: number | null;
  distance_km: number | null;
  max_capacity: number | null;
  flyer_url: string | null;
  images: string[] | null;
  video_url: string | null;
  accepted_payment_methods: string[] | null;
  taxa_gratis: boolean | null;
};

type ClientBenefits = {
  id: string;
  pontos: number | null;
  cashback_saldo: number | null;
};

function formatCurrency(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatTrailDate(value: string) {
  try {
    return format(parseISO(value), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
      locale: ptBR,
    });
  } catch {
    return value;
  }
}

function difficultyLabel(value: string | null) {
  if (!value) return "Nível a confirmar";
  const normalized = value.toLowerCase();
  if (normalized === "easy") return "Fácil";
  if (normalized === "hard") return "Difícil";
  if (normalized === "medium") return "Médio";
  return value;
}

export default function TrailCartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const cartQuantity = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0),
  );
  const [trail, setTrail] = useState<TrailForCart | null>(null);
  const [client, setClient] = useState<ClientBenefits | null>(null);
  const [reservedSpots, setReservedSpots] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCart() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user?.email) {
        router.replace("/app/login");
        return;
      }

      const [trailResult, clientResult, availabilityResult] = await Promise.all([
        supabase
          .from("agendas")
          .select(
            "id, title, date, price, description, difficulty, duration_hours, distance_km, max_capacity, flyer_url, images, video_url, accepted_payment_methods, taxa_gratis",
          )
          .eq("id", id)
          .single(),
        supabase
          .from("clients")
          .select("id, pontos, cashback_saldo")
          .eq("email", user.email)
          .single(),
        fetch(`/api/agendas/${id}/availability`, { cache: "no-store" }),
      ]);

      if (trailResult.error || !trailResult.data) {
        setError("Não foi possível encontrar esta trilha.");
        setLoading(false);
        return;
      }

      if (clientResult.error || !clientResult.data) {
        setError("Seu cadastro não foi encontrado. Entre novamente no aplicativo.");
        setLoading(false);
        return;
      }

      setTrail(trailResult.data as TrailForCart);
      setClient(clientResult.data as ClientBenefits);

      if (availabilityResult.ok) {
        const availability = await availabilityResult.json();
        setReservedSpots(Number(availability.reserved || 0));
      }

      const { data: reservation } = await supabase
        .from("reservas")
        .select("id, status_pagamento")
        .eq("client_id", clientResult.data.id)
        .eq("agenda_id", id)
        .in("status_pagamento", ["pago", "pendente"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reservation?.status_pagamento === "pago") {
        router.replace(`/app/trilhas/${id}`);
        return;
      }

      setLoading(false);
    }

    loadCart().catch(() => {
      setError("Não foi possível preparar seu carrinho. Tente novamente.");
      setLoading(false);
    });
  }, [id, router]);

  const media = useMemo(() => {
    if (!trail) return [];
    return Array.from(
      new Set([trail.flyer_url, ...(Array.isArray(trail.images) ? trail.images : [])].filter(Boolean)),
    ) as string[];
  }, [trail]);

  const remainingSpots = trail
    ? Math.max(0, Number(trail.max_capacity || 15) - reservedSpots)
    : 0;

  function addToCart() {
    if (!client || !trail || remainingSpots <= 0) return;
    setError(null);
    addItem({
      agendaId: trail.id,
      title: trail.title,
      price: Number(trail.price),
      date: trail.date,
      imageUrl: media[0] || null,
      difficulty: difficultyLabel(trail.difficulty),
      quantity: 1,
      dependents: [],
      availableSpots: remainingSpots,
      acceptedPaymentMethods:
        Array.isArray(trail.accepted_payment_methods) && trail.accepted_payment_methods.length
          ? trail.accepted_payment_methods
          : ["PIX"],
      taxa_gratis: trail.taxa_gratis === true,
    });
    router.push("/app/carrinho");
  }

  if (loading) {
    return (
      <div className="mt-app-page flex min-h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
        <p className="text-sm font-semibold text-slate-500">Preparando seu carrinho...</p>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="mt-app-page flex min-h-full flex-col items-center justify-center p-6 text-center">
        <Mountain className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-black text-[#071829]">Trilha indisponível</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => router.replace("/app/trilhas")}
          className="mt-6 rounded-2xl bg-[#0B2540] px-6 py-3 font-bold text-white"
        >
          Voltar para trilhas
        </button>
      </div>
    );
  }

  return (
    <div className="mt-app-page min-h-full pb-28">
      <header className="mt-app-header sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mt-eyebrow">Compra pelo aplicativo</p>
          <h1 className="truncate font-black text-[#071829]">Detalhes da compra</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/app/carrinho")}
          className="relative grid h-10 w-10 place-items-center rounded-full bg-[#FFF0E6] text-[#D96224]"
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="h-5 w-5" />
          {cartQuantity > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0B2540] px-1 text-[10px] font-black text-white">
              {cartQuantity}
            </span>
          )}
        </button>
      </header>

      <main className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
        <section className="overflow-hidden rounded-[1.75rem] bg-[#071829] text-white shadow-xl">
          <div className="relative aspect-[4/3] bg-[#0B2540]">
            {media.length > 0 ? (
              <Image
                src={media[currentImage]}
                alt={`Foto da trilha ${trail.title}`}
                fill
                priority
                sizes="(max-width: 672px) 100vw, 640px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#173D63,#071829)] text-blue-100">
                <Mountain className="h-16 w-16" />
                <p className="mt-3 text-sm font-bold">Fotos em breve</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#071829] via-transparent to-black/10" />

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentImage((value) => (value - 1 + media.length) % media.length)}
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentImage((value) => (value + 1) % media.length)}
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold backdrop-blur">
                  {currentImage + 1}/{media.length}
                </span>
              </>
            )}

            <div className="absolute inset-x-0 bottom-0 p-5">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#F17B37] px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                <TicketCheck className="h-3.5 w-3.5" /> {remainingSpots} vagas disponíveis
              </span>
              <h2 className="text-2xl font-black leading-tight">{trail.title}</h2>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="mt-surface rounded-2xl p-4">
            <CalendarDays className="mb-2 h-5 w-5 text-[#D96224]" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data</p>
            <p className="mt-1 text-sm font-bold capitalize text-[#071829]">
              {formatTrailDate(trail.date)}
            </p>
          </div>
          <div className="mt-surface rounded-2xl p-4">
            <Mountain className="mb-2 h-5 w-5 text-[#D96224]" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nível</p>
            <p className="mt-1 text-sm font-bold text-[#071829]">
              {difficultyLabel(trail.difficulty)}
            </p>
          </div>
          {trail.duration_hours ? (
            <div className="mt-surface rounded-2xl p-4">
              <Clock3 className="mb-2 h-5 w-5 text-[#D96224]" />
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Duração</p>
              <p className="mt-1 text-sm font-bold text-[#071829]">{trail.duration_hours} horas</p>
            </div>
          ) : null}
          {trail.distance_km ? (
            <div className="mt-surface rounded-2xl p-4">
              <MapPin className="mb-2 h-5 w-5 text-[#D96224]" />
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Percurso</p>
              <p className="mt-1 text-sm font-bold text-[#071829]">{trail.distance_km} km</p>
            </div>
          ) : null}
        </section>

        {trail.video_url ? (
          <section className="mt-surface overflow-hidden rounded-[1.75rem] p-3">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0E6] text-[#D96224]">
                <Play className="h-4 w-4 fill-current" />
              </span>
              <div>
                <p className="font-black text-[#071829]">Conheça esta aventura</p>
                <p className="text-xs text-slate-500">Vídeo promocional da trilha</p>
              </div>
            </div>
            <video
              src={trail.video_url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black object-contain"
            >
              Seu navegador não consegue reproduzir este vídeo.
            </video>
          </section>
        ) : null}

        {media.length > 1 ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Images className="h-5 w-5 text-[#D96224]" />
              <h3 className="font-black text-[#071829]">Fotos da experiência</h3>
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 app-mobile-scroll">
              {media.map((url, index) => (
                <button
                  type="button"
                  key={url}
                  onClick={() => setCurrentImage(index)}
                  className={`relative aspect-[4/3] w-32 shrink-0 snap-start overflow-hidden rounded-2xl border-2 ${
                    currentImage === index ? "border-[#F17B37]" : "border-transparent"
                  }`}
                  aria-label={`Abrir foto ${index + 1}`}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {trail.description ? (
          <section className="mt-surface rounded-[1.75rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D96224]" />
              <h3 className="font-black text-[#071829]">Sobre a experiência</h3>
            </div>
            <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {trail.description}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              O mapa, o ponto de encontro e a lista completa de preparação serão liberados após o pagamento.
            </p>
          </section>
        ) : null}

        <section className="mt-surface rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E7EEF6] text-[#0B2540]">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-[#071829]">
                {cartItems.some((item) => item.agendaId === trail.id)
                  ? "Esta trilha já está no carrinho"
                  : "Adicione sua primeira vaga"}
              </p>
              <p className="truncate text-xs text-slate-500">{trail.title}</p>
            </div>
            <p className="font-black text-[#D96224]">{formatCurrency(trail.price)}</p>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold text-slate-800">{formatCurrency(trail.price)}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-black text-[#071829]">Total</span>
              <span className="text-xl font-black text-[#071829]">{formatCurrency(trail.price)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex gap-3">
            <WalletCards className="h-5 w-5 shrink-0 text-[#0B2540]" />
            <div>
              <p className="text-sm font-black text-[#0B2540]">Use seus benefícios se quiser</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                No próximo passo você poderá escolher se deseja usar seu saldo disponível e seus pontos.
              </p>
              <p className="mt-2 text-xs font-bold text-slate-700">
                Saldo: {formatCurrency(Number(client?.cashback_saldo || 0))} · Pontos:{" "}
                {Number(client?.pontos || 0).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          Pix e cartão pela InfinitePay · boleto pelo Asaas
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-lg font-black text-[#071829]">{formatCurrency(trail.price)}</p>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={remainingSpots <= 0}
            className="flex min-h-12 flex-[1.7] items-center justify-center gap-2 rounded-2xl bg-[#0B2540] px-4 py-3.5 font-black text-white shadow-lg shadow-slate-950/15 transition-colors hover:bg-[#061B30] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-5 w-5" />
            {remainingSpots <= 0 ? "Trilha esgotada" : "Adicionar ao carrinho"}
            {remainingSpots > 0 ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </footer>
    </div>
  );
}
