"use client";

import { ChevronLeft, QrCode, CreditCard, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function PwaRecarregar() {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState("50,00");
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [copied, setCopied] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage?: string, payload?: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const [cardData, setCardData] = useState({
    number: "",
    holderName: "",
    expiry: "",
    ccv: "",
    postalCode: "",
    addressNumber: ""
  });

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

  const handleGeneratePix = async () => {
    if (!clientId) {
      alert("Erro: Cliente não identificado. Faça login novamente.");
      return;
    }
    setLoadingPix(true);
    try {
      const res = await fetch('/api/checkout-asaas/recarregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount.replace(',', '.'), clientId, method: 'pix' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setPixData({ encodedImage: data.encodedImage, payload: data.payload });
    } catch (err: any) {
      alert("Erro ao gerar PIX: " + err.message);
    } finally {
      setLoadingPix(false);
    }
  };

  const handleCardPayment = async () => {
    if (!clientId) {
      alert("Erro: Cliente não identificado."); return;
    }
    if (!cardData.number || !cardData.holderName || !cardData.expiry || !cardData.ccv || !cardData.postalCode || !cardData.addressNumber) {
      alert("Preencha todos os dados do cartão."); return;
    }
    setLoadingCard(true);
    try {
      const [month, year] = cardData.expiry.split('/');
      const res = await fetch('/api/checkout-asaas/recarregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amount.replace(',', '.'), 
          clientId, 
          method: 'cartao',
          creditCard: {
            holderName: cardData.holderName,
            number: cardData.number.replace(/\D/g, ''),
            expiryMonth: month,
            expiryYear: year?.length === 2 ? `20${year}` : year,
            ccv: cardData.ccv
          },
          postalCode: cardData.postalCode,
          addressNumber: cardData.addressNumber,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      alert("Erro ao processar cartão: " + err.message);
    } finally {
      setLoadingCard(false);
    }
  };

  const handleCopy = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">Pagamento Recebido</h2>
        <p className="text-gray-500 mb-8">O saldo será creditado automaticamente após a confirmação da Asaas.</p>
        <button 
          onClick={() => router.push('/app/loja')}
          className="w-full max-w-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl transition-colors"
        >
          Voltar para Loja
        </button>
      </div>
    );
  }

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

        {/* Seleção de Método */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => setMethod("pix")}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${method === 'pix' ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
          >
            <QrCode className={`w-8 h-8 ${method === 'pix' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className={`font-bold text-sm ${method === 'pix' ? 'text-purple-700' : 'text-gray-500'}`}>Pix</span>
          </button>
          
          <button 
            onClick={() => setMethod("cartao")}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${method === 'cartao' ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
          >
            <CreditCard className={`w-8 h-8 ${method === 'cartao' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className={`font-bold text-sm ${method === 'cartao' ? 'text-purple-700' : 'text-gray-500'}`}>Cartão</span>
          </button>
        </div>

        {/* Detalhes do Método */}
        <AnimatePresence mode="wait">
          {method === 'pix' ? (
            <motion.div 
              key="pix"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center"
            >
              {!pixData ? (
                <>
                  <div className="w-24 h-24 bg-purple-50 rounded-2xl mb-4 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-purple-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 mb-2">Gerar Cobrança Pix</p>
                  <p className="text-xs text-gray-500 mb-6">O saldo será liberado instantaneamente após o pagamento do PIX gerado.</p>
                  
                  <button 
                    onClick={handleGeneratePix}
                    disabled={loadingPix}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingPix ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                    {loadingPix ? "Conectando ao Asaas..." : "Gerar QR Code Pix"}
                  </button>
                </>
              ) : (
                <>
                  <div className="w-48 h-48 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                    <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code PIX" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 mb-2">Escaneie o QR Code ou copie o código</p>
                  <p className="text-xs text-gray-500 mb-4">Aguardando confirmação do pagamento...</p>
                  
                  <button 
                    onClick={handleCopy}
                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-purple-200"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    {copied ? "Código Copiado!" : "Copiar Código Pix (Copia e Cola)"}
                  </button>
                  <button 
                    onClick={() => { setPixData(null); setAmount("50,00"); }}
                    className="w-full mt-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    Cancelar / Gerar Novo
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="cartao"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Número do Cartão</label>
                  <input 
                    type="text" placeholder="0000 0000 0000 0000" 
                    value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Validade</label>
                    <input 
                      type="text" placeholder="MM/AA" 
                      value={cardData.expiry} onChange={e => setCardData({...cardData, expiry: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">CVV</label>
                    <input 
                      type="text" placeholder="123" 
                      value={cardData.ccv} onChange={e => setCardData({...cardData, ccv: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome no Cartão</label>
                  <input 
                    type="text" placeholder="NOME DO TITULAR" 
                    value={cardData.holderName} onChange={e => setCardData({...cardData, holderName: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">CEP</label>
                    <input
                      type="text" placeholder="00000-000" maxLength={9}
                      value={cardData.postalCode}
                      onChange={e => setCardData({...cardData, postalCode: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Número</label>
                    <input
                      type="text" placeholder="123"
                      value={cardData.addressNumber}
                      onChange={e => setCardData({...cardData, addressNumber: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleCardPayment}
                disabled={loadingCard}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingCard ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loadingCard ? "Processando..." : "Confirmar Pagamento"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
