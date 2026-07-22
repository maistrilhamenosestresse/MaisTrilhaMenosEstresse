"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, CreditCard, CheckCircle2,
  Loader2, Calendar, ShieldCheck, Sparkles, WalletCards, Coins, FileText
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { calculateGrossPrice } from "@/lib/fees";
import {
  AsaasPaymentStatus,
  type AsaasPaymentResult,
} from "@/components/payments/AsaasPaymentStatus";
import { BoletoInstallmentSelector } from "@/components/payments/BoletoInstallmentSelector";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

function TrailCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservaId = searchParams.get("reservaId");
  const agendaId = searchParams.get("agendaId");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [useCashback, setUseCashback] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"INFINITEPAY" | "BOLETO">("INFINITEPAY");
  const [boletoInstallments, setBoletoInstallments] = useState(1);
  const [paymentResult, setPaymentResult] = useState<AsaasPaymentResult | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!reservaId || !agendaId) {
        router.push("/app/trilhas");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/app/login"); return; }

      const [agendaRes, clientRes] = await Promise.all([
        supabase.from("agendas").select("*").eq("id", agendaId).single(),
        supabase.from("clients").select("*").eq("email", user.email).single(),
      ]);

      if (agendaRes.data) setAgenda(agendaRes.data);
      if (clientRes.data) setClient(clientRes.data);
      setLoading(false);
    }
    loadData();
  }, [reservaId, agendaId]);

  const handleCheckout = async () => {
    if (!client || !agenda || !reservaId) return;

    setProcessing(true);
    try {
      const payload: any = {
        reserva_ids: [reservaId],
        payment_method: paymentMethod,
        installments: paymentMethod === "BOLETO" ? boletoInstallments : 1,
        checkout_source: "app",
        use_cashback: useCashback,
        use_points: usePoints,
        customer_data: {
          name: client.full_name || "Cliente",
          email: client.email,
          cpf: client.cpf || "00000000000",
          phone: client.phone || "00000000000",
          postalCode: client.postal_code || "00000000",
          addressNumber: client.address_number || "0",
        },
      };

      const res = await fetch("/api/checkout-asaas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no pagamento");

      if (data.type === "INTERNAL") {
        setSuccess(true);
      } else if (data.provider === "INFINITEPAY" && data.redirectUrl) {
        window.sessionStorage.setItem(
          `infinitepay:${data.orderNsu}:returnTo`,
          `/app/trilhas/${agendaId}`,
        );
        window.location.assign(data.redirectUrl);
      } else if (data.provider === "ASAAS" && data.paymentId) {
        setPaymentResult(data as AsaasPaymentResult);
      }
    } catch (err: any) {
      alert("Erro ao processar pagamento: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const acceptedPaymentMethods = Array.isArray(agenda?.accepted_payment_methods) &&
    agenda.accepted_payment_methods.length > 0
    ? agenda.accepted_payment_methods
    : ["PIX"];
  const acceptsPix = acceptedPaymentMethods.includes("PIX");
  const acceptsCard = acceptedPaymentMethods.includes("CREDIT_CARD");
  const acceptsBoleto = acceptedPaymentMethods.includes("BOLETO");
  const acceptsInfinitePay = acceptsPix || acceptsCard;

  useEffect(() => {
    if (paymentMethod === "INFINITEPAY" && acceptsInfinitePay) return;
    if (paymentMethod === "BOLETO" && acceptsBoleto) return;
    setPaymentMethod(acceptsInfinitePay ? "INFINITEPAY" : "BOLETO");
  }, [acceptsBoleto, acceptsInfinitePay, paymentMethod]);

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }); }
    catch { return dateStr; }
  };

  const formatCurrency = (val: number) =>
    Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  // --- TELA DE SUCESSO ---
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-app-page flex min-h-full flex-col items-center justify-center p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[linear-gradient(145deg,#0B2540,#F17B37)] shadow-2xl"
        >
          <CheckCircle2 className="w-14 h-14 text-white" />
        </motion.div>
        <h2 className="text-3xl font-black text-gray-800 mb-3">Vaga Garantida!</h2>
        <p className="text-gray-500 mb-2 font-medium">
          Seu pagamento foi aprovado com sucesso.
        </p>
        <p className="text-sm text-gray-400 mb-10">
          {agenda?.title} • {agenda?.date ? formatDate(agenda.date) : ""}
        </p>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => router.push("/app/trilhas")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-4 font-bold text-white shadow-lg transition-all hover:bg-[#061B30]"
          >
            <Sparkles className="w-5 h-5" /> Ver Minhas Aventuras
          </button>
          <button
            onClick={() => router.push(`/app/album/${agendaId}`)}
            className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl transition-all"
          >
            Acessar Álbum Inteligente
          </button>
        </div>
      </motion.div>
    );
  }

  const price = Number(agenda?.price || 0);
  const grossPrice = price;
  const cashbackAvailable = Math.max(0, Number(client?.cashback_saldo || 0));
  const pointsAvailable = Math.max(0, Number(client?.pontos || 0));
  const cashbackApplied = useCashback ? Math.min(cashbackAvailable, grossPrice) : 0;
  const pointsApplied = usePoints
    ? Math.min(pointsAvailable, Math.floor(Math.max(0, grossPrice - cashbackApplied) * 100))
    : 0;
  const netAmountDue = Math.max(0, grossPrice - cashbackApplied - pointsApplied / 100);
  const amountDue = netAmountDue;
  const chargedAmount = amountDue <= 0 || agenda?.taxa_gratis
    ? amountDue
    : paymentMethod === "BOLETO"
      ? calculateGrossPrice(amountDue, "BOLETO", boletoInstallments)
      : amountDue;

  if (paymentResult) {
    return (
      <div className="mt-app-page min-h-full p-4 pb-28 sm:p-6">
        <button
          type="button"
          onClick={() => setPaymentResult(null)}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0B2540]"
        >
          <ChevronLeft className="h-5 w-5" />
          Voltar às formas de pagamento
        </button>
        <AsaasPaymentStatus
          payment={paymentResult}
          onConfirmed={() => setSuccess(true)}
        />
      </div>
    );
  }

  return (
    <div className="mt-app-page flex min-h-full flex-col pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div>
          <h1 className="font-black text-gray-800 text-base">Finalizar Compra</h1>
          <p className="text-xs text-gray-400 font-medium">Pagamento seguro e criptografado</p>
        </div>
        <ShieldCheck className="w-6 h-6 text-green-500 ml-auto" />
      </div>

      <div className="p-5 space-y-5">
        {/* Resumo da Trilha */}
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#061526,#0B2540)] p-5 text-white shadow-lg">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-white/5 rounded-full" />
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-orange-200">Sua vaga em</p>
          <h2 className="font-black text-xl leading-tight mb-3">{agenda?.title}</h2>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-100/75">
            <Calendar className="w-4 h-4" />
            <span>{agenda?.date ? formatDate(agenda.date) : "Data a confirmar"}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-sm font-medium text-blue-100/75">Total do pagamento</span>
            <span className="text-2xl font-black">{formatCurrency(grossPrice)}</span>
          </div>
        </div>

        {/* Benefícios da carteira */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div>
            <h3 className="font-black text-gray-800">Usar seus benefícios?</h3>
            <p className="text-xs text-gray-500 mt-1">
              Você escolhe agora. O saldo só é reservado ao confirmar o pagamento.
            </p>
          </div>

          <button
            type="button"
            disabled={cashbackAvailable <= 0}
            onClick={() => setUseCashback((value) => !value)}
            className={`w-full rounded-2xl border p-4 text-left flex items-center gap-3 transition ${
              useCashback ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-gray-50"
            } disabled:opacity-50`}
          >
            <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
              <WalletCards className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-black text-gray-800">Saldo disponível</span>
              <span className="block text-xs text-gray-500">
                Saldo disponível: {formatCurrency(cashbackAvailable)}
              </span>
            </span>
            <span className={`w-11 h-6 rounded-full p-1 transition ${useCashback ? "bg-emerald-500" : "bg-gray-300"}`}>
              <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${useCashback ? "translate-x-5" : ""}`} />
            </span>
          </button>

          <button
            type="button"
            disabled={pointsAvailable <= 0}
            onClick={() => setUsePoints((value) => !value)}
            className={`w-full rounded-2xl border p-4 text-left flex items-center gap-3 transition ${
              usePoints ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"
            } disabled:opacity-50`}
          >
            <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
              <Coins className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-black text-gray-800">Pontos</span>
              <span className="block text-xs text-gray-500">
                {pointsAvailable} pontos = {formatCurrency(pointsAvailable / 100)}
              </span>
            </span>
            <span className={`w-11 h-6 rounded-full p-1 transition ${usePoints ? "bg-amber-500" : "bg-gray-300"}`}>
              <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${usePoints ? "translate-x-5" : ""}`} />
            </span>
          </button>

          <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-2 text-sm">
            {cashbackApplied > 0 && (
              <div className="flex justify-between text-emerald-300">
                <span>Saldo utilizado</span>
                <span>- {formatCurrency(cashbackApplied)}</span>
              </div>
            )}
            {pointsApplied > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>{pointsApplied} pontos utilizados</span>
                <span>- {formatCurrency(pointsApplied / 100)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base pt-2 border-t border-white/10">
              <span>Você paga agora</span>
              <span>{formatCurrency(amountDue)}</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            Compras concluídas nesta tela geram 1 ponto por real efetivamente pago. Compras feitas fora do app não geram pontos.
          </p>
        </div>

        <motion.div initial={{ opacity: 1 }} className="space-y-4">
          <h3 className="font-bold text-gray-700 text-sm">
            {amountDue > 0 ? "Forma de Pagamento" : "Pagamento coberto pelos benefícios"}
          </h3>

          {amountDue > 0 && (acceptsInfinitePay || acceptsBoleto) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {acceptsInfinitePay && (
                <PaymentMethodButton
                  selected={paymentMethod === "INFINITEPAY"}
                  onClick={() => setPaymentMethod("INFINITEPAY")}
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Pix ou cartão"
                  description="InfinitePay · cartão em até 12x"
                />
              )}
              {acceptsBoleto && (
                <PaymentMethodButton
                  selected={paymentMethod === "BOLETO"}
                  onClick={() => setPaymentMethod("BOLETO")}
                  icon={<FileText className="h-5 w-5" />}
                  title="Boleto"
                  description="Asaas · à vista ou em até 12x"
                />
              )}
            </div>
          )}

          {amountDue > 0 && paymentMethod === "BOLETO" && acceptsBoleto && (
            <BoletoInstallmentSelector
              netAmount={amountDue}
              installments={boletoInstallments}
              onChange={setBoletoInstallments}
              absorbFee={agenda?.taxa_gratis === true}
            />
          )}

          {amountDue > 0 && !acceptsInfinitePay && !acceptsBoleto && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Esta trilha não possui uma forma de pagamento habilitada.
            </div>
          )}

          {amountDue > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-[#E7EEF6] p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="font-bold text-gray-600">
                  {paymentMethod === "BOLETO" ? "Total do boleto Asaas" : "Valor enviado à InfinitePay"}
                </span>
                <span className="font-black text-[#0B2540]">{formatCurrency(chargedAmount)}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                {paymentMethod === "BOLETO"
                  ? "O valor inclui a tarifa do boleto quando a organização não absorve a taxa."
                  : "A InfinitePay mostra qualquer acréscimo e as parcelas antes da confirmação."}
              </p>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={
              processing ||
              (amountDue > 0 &&
                ((paymentMethod === "INFINITEPAY" && !acceptsInfinitePay) ||
                  (paymentMethod === "BOLETO" && !acceptsBoleto)))
            }
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0B2540] py-4 text-base font-black text-white shadow-lg transition-all hover:bg-[#061B30] disabled:opacity-60"
          >
            {processing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparando pagamento...</>
            ) : amountDue <= 0 ? (
              <><CheckCircle2 className="w-5 h-5" /> Confirmar com benefícios</>
            ) : (
              <><ShieldCheck className="w-5 h-5" /> {paymentMethod === "BOLETO" ? "Gerar boleto Asaas" : "Continuar na InfinitePay"}</>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function PaymentMethodButton({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#0B2540] bg-[#E7EEF6] text-[#0B2540]"
          : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {icon}
      <span className="mt-2 block text-sm font-black">{title}</span>
      <span className="mt-1 block text-[11px]">{description}</span>
    </button>
  );
}

export default function TrailCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    }>
      <TrailCheckoutContent />
    </Suspense>
  );
}
