"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/store/cartStore";

function formatCurrency(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatCpf(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d)(\d{4})$/, "$1-$2");
}

export default function AppCartPage() {
  const router = useRouter();
  const {
    items,
    updateQuantity,
    updateDependent,
    removeItem,
    getTotalPrice,
    getTotalQuantity,
  } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    for (const item of useCartStore.getState().items) {
      useCartStore.getState().updateQuantity(item.agendaId, item.quantity);
    }
  }, []);

  const missingCompanions = useMemo(
    () =>
      items.some(
        (item) =>
          item.quantity > 1 &&
          (item.dependents?.length !== item.quantity - 1 ||
            item.dependents.some(
              (dependent) =>
                dependent.name.trim().length < 3 ||
                dependent.cpf.replace(/\D/g, "").length !== 11 ||
                String(dependent.phone || "").replace(/\D/g, "").length < 10,
            )),
      ),
    [items],
  );

  async function continueToCheckout() {
    if (!items.length || missingCompanions) return;
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/create-reserva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout_source: "app",
          items: items.map((item) => ({
            agendaId: item.agendaId,
            dependents: item.dependents || [],
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.reservas) || !result.reservas.length) {
        throw new Error(result.error || "Não foi possível reservar as vagas.");
      }

      const reservationIds = result.reservas.map((reservation: { id: string }) => reservation.id);
      const firstItem = items[0];
      window.sessionStorage.setItem(
        "mt-app-trail-checkout",
        JSON.stringify({
          reservationIds,
          invitations: result.invitations || [],
          items: items.map((item) => ({
            agendaId: item.agendaId,
            title: item.title,
            date: item.date,
            price: item.price,
            quantity: item.quantity,
            acceptedPaymentMethods: item.acceptedPaymentMethods || ["PIX"],
            taxaGratis: item.taxa_gratis === true,
          })),
        }),
      );
      router.push(
        `/app/trilhas/${firstItem.agendaId}/checkout?reservaId=${reservationIds[0]}&agendaId=${firstItem.agendaId}&reservaIds=${encodeURIComponent(reservationIds.join(","))}&lote=1`,
      );
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Não foi possível continuar para o pagamento.",
      );
      setProcessing(false);
    }
  }

  if (!mounted) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  return (
    <div className="mt-app-page min-h-full pb-28">
      <header className="mt-app-header sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/app/trilhas")}
          className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700"
          aria-label="Voltar para trilhas"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mt-eyebrow">Planeje sua próxima aventura</p>
          <h1 className="font-black text-[#071829]">Carrinho de trilhas</h1>
        </div>
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-[#FFF0E6] text-[#D96224]">
          <ShoppingCart className="h-5 w-5" />
          {getTotalQuantity() > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0B2540] px-1 text-[10px] font-black text-white">
              {getTotalQuantity()}
            </span>
          )}
        </span>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        {items.length === 0 ? (
          <section className="mt-surface rounded-[2rem] px-6 py-12 text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#FFF0E6] text-[#D96224]">
              <ShoppingBag className="h-9 w-9" />
            </span>
            <h2 className="mt-5 text-xl font-black text-[#071829]">Seu carrinho está vazio</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              Escolha uma ou várias trilhas e finalize tudo em uma única compra.
            </p>
            <button
              type="button"
              onClick={() => router.push("/app/trilhas")}
              className="mt-6 rounded-2xl bg-[#0B2540] px-6 py-3.5 font-black text-white"
            >
              Explorar trilhas
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-blue-100 bg-[#E7EEF6] p-4">
              <p className="text-sm font-black text-[#0B2540]">
                {items.length} {items.length === 1 ? "trilha selecionada" : "trilhas selecionadas"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Combine datas diferentes e compre vagas para acompanhantes no mesmo pagamento.
              </p>
            </section>

            {items.map((item) => {
              const companions = item.dependents || [];
              const hasIncomplete = item.quantity > 1 && companions.some(
                (dependent) =>
                  dependent.name.trim().length < 3 ||
                  dependent.cpf.replace(/\D/g, "").length !== 11 ||
                  String(dependent.phone || "").replace(/\D/g, "").length < 10,
              );

              return (
                <motion.section
                  layout
                  key={item.agendaId}
                  className="mt-surface overflow-hidden rounded-[1.75rem]"
                >
                  <div className="flex gap-3 p-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-3xl">🏞️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#D96224]">
                        {item.difficulty || "Aventura"}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-sm font-black leading-tight text-[#071829]">
                        {item.title}
                      </h2>
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold capitalize text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatDate(item.date)}
                      </p>
                      <p className="mt-1 font-black text-[#D96224]">{formatCurrency(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.agendaId)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-500"
                      aria-label={`Remover ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vagas</p>
                      <p className="text-xs font-bold text-slate-600">1 titular + acompanhantes</p>
                    </div>
                    <div className="flex items-center rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.agendaId, Math.max(1, item.quantity - 1))}
                        className="grid h-9 w-9 place-items-center rounded-lg text-slate-600"
                        aria-label="Diminuir vagas"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-black text-[#071829]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.agendaId, item.quantity + 1)}
                        disabled={item.quantity >= item.availableSpots}
                        className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 disabled:opacity-30"
                        aria-label="Aumentar vagas"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {item.quantity > 1 && (
                    <div className="border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [item.agendaId]: !current[item.agendaId],
                          }))
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0E6] text-[#D96224]">
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-[#071829]">
                            Dados dos acompanhantes
                          </span>
                          <span className={`block text-[11px] font-bold ${hasIncomplete ? "text-red-500" : "text-emerald-600"}`}>
                            {hasIncomplete ? "Preenchimento obrigatório" : "Dados completos"}
                          </span>
                        </span>
                        {expanded[item.agendaId] ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </button>

                      <AnimatePresence>
                        {expanded[item.agendaId] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-4 bg-slate-50 p-4">
                              {companions.map((dependent, index) => (
                                <div key={index} className="rounded-2xl bg-white p-4 shadow-sm">
                                  <p className="mb-3 text-xs font-black text-[#071829]">
                                    Acompanhante {index + 1}
                                  </p>
                                  <div className="space-y-3">
                                    <input
                                      value={dependent.name}
                                      onChange={(event) =>
                                        updateDependent(item.agendaId, index, "name", event.target.value)
                                      }
                                      placeholder="Nome completo"
                                      autoComplete="name"
                                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#D96224]"
                                    />
                                    <input
                                      value={dependent.cpf}
                                      onChange={(event) =>
                                        updateDependent(item.agendaId, index, "cpf", formatCpf(event.target.value))
                                      }
                                      placeholder="CPF"
                                      inputMode="numeric"
                                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#D96224]"
                                    />
                                    <input
                                      value={dependent.phone || ""}
                                      onChange={(event) =>
                                        updateDependent(item.agendaId, index, "phone", formatPhone(event.target.value))
                                      }
                                      placeholder="WhatsApp"
                                      inputMode="tel"
                                      autoComplete="tel"
                                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#D96224]"
                                    />
                                  </div>
                                </div>
                              ))}
                              <p className="text-[10px] leading-relaxed text-slate-500">
                                Por privacidade, os dados pessoais dos acompanhantes não ficam salvos permanentemente no aparelho.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.section>
              );
            })}

            <button
              type="button"
              onClick={() => router.push("/app/trilhas")}
              className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3.5 text-sm font-black text-[#0B2540]"
            >
              + Adicionar outras trilhas
            </button>

            <section className="mt-surface rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{getTotalQuantity()} vagas</span>
                <span>{items.length} datas</span>
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total das trilhas</p>
                  <p className="mt-1 text-2xl font-black text-[#071829]">{formatCurrency(getTotalPrice())}</p>
                </div>
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Saldo e pontos são opcionais e serão calculados com segurança no próximo passo.
              </p>
            </section>

            {missingCompanions && (
              <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                Preencha o nome, CPF e WhatsApp de todos os acompanhantes para continuar.
              </p>
            )}
            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
          </>
        )}
      </main>

      {items.length > 0 && (
        <footer className="fixed inset-x-0 bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</p>
              <p className="text-lg font-black text-[#071829]">{formatCurrency(getTotalPrice())}</p>
            </div>
            <button
              type="button"
              onClick={continueToCheckout}
              disabled={processing || missingCompanions}
              className="flex min-h-12 flex-[1.65] items-center justify-center gap-2 rounded-2xl bg-[#0B2540] px-4 py-3.5 font-black text-white shadow-lg disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              Revisar pagamento
              {!processing && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
