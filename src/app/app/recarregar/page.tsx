"use client";

import { ChevronLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { fetchCurrentClient } from "@/lib/app/current-client";

export default function PwaRecarregar() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState("50,00");
  const [processing, setProcessing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const client = await fetchCurrentClient<{ id: string }>();
        if (client) setClientId(client.id);
      }
    }
    getUser();
  }, [supabase]);

  const handleCheckout = async () => {
    if (!clientId) {
      alert("Erro: Cliente não identificado. Faça login novamente.");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch('/api/checkout-asaas/recarregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount.replace(',', '.'), clientId, method: "infinitepay" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao preparar o pagamento");
      if (data.provider !== "INFINITEPAY" || !data.redirectUrl) {
        throw new Error("Resposta inválida do pagamento");
      }
      window.sessionStorage.setItem(`infinitepay:${data.orderNsu}:returnTo`, "/app/extratos");
      window.location.assign(data.redirectUrl);
    } catch (err: any) {
      alert("Erro ao preparar recarga: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const netAmount = Number(amount.replace(",", "."));
  return (
    <div className="mt-app-page relative flex min-h-full flex-col">
      
      {/* Seamless Transition Overlay: Comes from the previous page's expansion */}
      <motion.div 
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.0, ease: "easeInOut" }} // Fade-out relaxado revelando a tela montada
        className="pointer-events-none fixed inset-0 z-[100] bg-[#F17B37]"
      />

      {/* Header Fixo */}
      <div className="mt-app-header sticky top-0 z-50 flex items-center gap-4 border-b px-4 py-3">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="font-black text-gray-800 text-lg">Recarregar Saldo</h1>
      </div>

      <div className="flex-1 px-4 py-8 pb-24 sm:px-6">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 text-center">Valor da Recarga</p>
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl font-black text-gray-400">R$</span>
          <input 
            type="text" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-5xl font-black text-gray-800 bg-transparent border-none w-48 text-center focus:ring-0 p-0"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-surface rounded-3xl p-6"
        >
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-[#0B2540] bg-[#E7EEF6] p-4 text-left text-[#0B2540]">
              <CreditCard className="h-5 w-5" />
              <span className="mt-2 block text-sm font-black">Pix ou cartão</span>
              <span className="text-[11px]">InfinitePay · cartão em até 12x</span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-[#071829] p-4 text-white">
            <div className="flex justify-between text-sm">
              <span>Saldo que será creditado</span>
              <strong>{formatCurrency(Number.isFinite(netAmount) ? netAmount : 0)}</strong>
            </div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
              <span className="font-bold">Valor da recarga</span>
              <strong>{formatCurrency(Number.isFinite(netAmount) ? netAmount : 0)}</strong>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            O saldo só será creditado após confirmação oficial do pagamento.
          </p>
          <button
            onClick={handleCheckout}
            disabled={processing}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-4 font-bold text-white transition-colors hover:bg-[#061B30] disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {processing ? "Preparando pagamento..." : "Continuar na InfinitePay"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
