"use client";

import { ChevronLeft, QrCode, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function PwaRecarregar() {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState("50,00");
  const [processing, setProcessing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: client } = await supabase.from('clients').select('id').eq('email', user.email).single();
        if (client) setClientId(client.id);
      }
    }
    getUser();
  }, []);

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
        body: JSON.stringify({ amount: amount.replace(',', '.'), clientId, method: 'infinitepay' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar checkout");
      if (data.type !== 'INFINITEPAY' || !data.redirectUrl) {
        throw new Error("Resposta inválida do checkout");
      }
      window.sessionStorage.setItem(`infinitepay:${data.orderNsu}:returnTo`, '/app/extratos');
      window.location.assign(data.redirectUrl);
    } catch (err: any) {
      alert("Erro ao preparar recarga: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      
      {/* Seamless Transition Overlay: Comes from the previous page's expansion */}
      <motion.div 
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.0, ease: "easeInOut" }} // Fade-out relaxado revelando a tela montada
        className="fixed inset-0 bg-purple-600 z-[100] pointer-events-none"
      />

      {/* Header Fixo */}
      <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="font-black text-gray-800 text-lg">Recarregar Saldo</h1>
      </div>

      <div className="px-6 py-8 flex-1 overflow-y-auto pb-24">
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
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
              <QrCode className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="font-black text-gray-800">Pix ou cartão</p>
              <p className="text-xs text-gray-500">Escolha no checkout seguro da InfinitePay.</p>
            </div>
            <CreditCard className="w-6 h-6 text-purple-500 ml-auto" />
          </div>
          <p className="text-[11px] text-gray-500 mt-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            O saldo só será creditado após confirmação oficial do pagamento.
          </p>
          <button
            onClick={handleCheckout}
            disabled={processing}
            className="w-full mt-5 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {processing ? "Preparando checkout..." : "Continuar para InfinitePay"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
