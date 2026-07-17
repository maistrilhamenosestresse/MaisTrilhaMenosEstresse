"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, QrCode, CreditCard, Copy, CheckCircle2,
  Loader2, Calendar, ShieldCheck, Sparkles, X
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

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
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    holderName: "",
    expiry: "",
    ccv: "",
  });
  const [installments, setInstallments] = useState(1);

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

    if (paymentMethod === "CREDIT_CARD") {
      if (!cardData.number || !cardData.holderName || !cardData.expiry || !cardData.ccv) {
        alert("Preencha todos os dados do cartão.");
        return;
      }
    }

    setProcessing(true);
    try {
      const [month, year] = cardData.expiry.split("/");
      const payload: any = {
        reserva_ids: [reservaId],
        payment_method: paymentMethod,
        installments: paymentMethod === "CREDIT_CARD" ? installments : 1,
        customer_data: {
          name: client.full_name || "Cliente",
          email: client.email,
          cpf: client.cpf || "00000000000",
          phone: client.phone || "00000000000",
          postalCode: client.postal_code || "00000000",
          addressNumber: client.address_number || "0",
        },
      };

      if (paymentMethod === "CREDIT_CARD") {
        payload.credit_card_data = {
          holderName: cardData.holderName,
          number: cardData.number.replace(/\D/g, ""),
          expiryMonth: month?.trim(),
          expiryYear: year?.trim().length === 2 ? `20${year.trim()}` : year?.trim(),
          ccv: cardData.ccv,
          installmentCount: installments,
        };
      }

      const res = await fetch("/api/checkout-asaas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no checkout");

      if (data.type === "PIX") {
        setPixData({ encodedImage: data.encodedImage, payload: data.payload });
      } else if (data.type === "CREDIT_CARD") {
        setSuccess(true);
      }
    } catch (err: any) {
      alert("Erro ao processar pagamento: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }); }
    catch { return dateStr; }
  };

  const formatCurrency = (val: number) =>
    Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // --- TELA DE SUCESSO ---
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex flex-col items-center justify-center p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-28 h-28 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-2xl"
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
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
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
        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-5 text-white relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-white/5 rounded-full" />
          <p className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">Sua vaga em</p>
          <h2 className="font-black text-xl leading-tight mb-3">{agenda?.title}</h2>
          <div className="flex items-center gap-2 text-purple-200 text-sm font-medium">
            <Calendar className="w-4 h-4" />
            <span>{agenda?.date ? formatDate(agenda.date) : "Data a confirmar"}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-purple-200 text-sm font-medium">Total</span>
            <span className="text-2xl font-black">{formatCurrency(price)}</span>
          </div>
        </div>

        {/* Seleção de Método de Pagamento */}
        <AnimatePresence>
          {!pixData && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <h3 className="font-bold text-gray-700 text-sm">Forma de Pagamento</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("PIX")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                    paymentMethod === "PIX"
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <QrCode className={`w-7 h-7 ${paymentMethod === "PIX" ? "text-purple-600" : "text-gray-400"}`} />
                  <span className={`font-bold text-sm ${paymentMethod === "PIX" ? "text-purple-700" : "text-gray-500"}`}>
                    Pix
                  </span>
                  <span className={`text-[10px] font-medium ${paymentMethod === "PIX" ? "text-purple-400" : "text-gray-400"}`}>
                    Aprovação imediata
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("CREDIT_CARD")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                    paymentMethod === "CREDIT_CARD"
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <CreditCard className={`w-7 h-7 ${paymentMethod === "CREDIT_CARD" ? "text-purple-600" : "text-gray-400"}`} />
                  <span className={`font-bold text-sm ${paymentMethod === "CREDIT_CARD" ? "text-purple-700" : "text-gray-500"}`}>
                    Cartão
                  </span>
                  <span className={`text-[10px] font-medium ${paymentMethod === "CREDIT_CARD" ? "text-purple-400" : "text-gray-400"}`}>
                    Até 12x
                  </span>
                </button>
              </div>

              {/* Formulário de Cartão */}
              <AnimatePresence>
                {paymentMethod === "CREDIT_CARD" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Número do Cartão
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardData.number}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                          setCardData({ ...cardData, number: v });
                        }}
                        className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Nome no Cartão
                      </label>
                      <input
                        type="text"
                        placeholder="NOME DO TITULAR"
                        value={cardData.holderName}
                        onChange={(e) => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                        className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none uppercase"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Validade
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="MM/AA"
                          maxLength={5}
                          value={cardData.expiry}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, "");
                            if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                            setCardData({ ...cardData, expiry: v });
                          }}
                          className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          CVV
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="123"
                          maxLength={4}
                          value={cardData.ccv}
                          onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, "") })}
                          className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    {/* Parcelas */}
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Parcelas
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <option key={n} value={n}>
                            {n}x de {formatCurrency(price / n)} {n === 1 ? "(sem juros)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={handleCheckout}
                disabled={processing}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-60 text-base"
              >
                {processing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                ) : paymentMethod === "PIX" ? (
                  <><QrCode className="w-5 h-5" /> Gerar QR Code Pix</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Confirmar Pagamento</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Pix */}
        <AnimatePresence>
          {pixData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center"
            >
              <div className="w-52 h-52 bg-gray-50 rounded-2xl mb-5 flex items-center justify-center p-3 overflow-hidden border border-gray-200 shadow-inner">
                <img
                  src={`data:image/png;base64,${pixData.encodedImage}`}
                  alt="QR Code PIX"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="font-black text-gray-800 text-lg mb-1">Escaneie o QR Code</h3>
              <p className="text-sm text-gray-500 mb-5 font-medium">
                Sua vaga será confirmada assim que o Pix for pago.
              </p>
              <button
                onClick={handleCopy}
                className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-purple-200 mb-3"
              >
                {copied ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-500" /> Código Copiado!</>
                ) : (
                  <><Copy className="w-5 h-5" /> Copiar Código (Copia e Cola)</>
                )}
              </button>
              <button
                onClick={() => setPixData(null)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar e gerar novo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TrailCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <TrailCheckoutContent />
    </Suspense>
  );
}
