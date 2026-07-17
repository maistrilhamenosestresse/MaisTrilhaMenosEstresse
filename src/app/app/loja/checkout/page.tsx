"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, QrCode, CheckCircle2, Copy, Loader2, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LojaCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const produtoId = searchParams.get("produtoId");
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  
  const [processing, setProcessing] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formaEntrega, setFormaEntrega] = useState<"retirada" | "correios" | "entrega_trilha">("retirada");
  const [deliveryInfo, setDeliveryInfo] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [cardData, setCardData] = useState({
    number: "",
    holderName: "",
    expiry: "",
    ccv: "",
    postalCode: "",
    addressNumber: ""
  });

  useEffect(() => {
    async function loadData() {
      if (!produtoId) {
        router.push("/app/loja");
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/app/login");
        return;
      }

      const [prodRes, clientRes] = await Promise.all([
        supabase.from('produtos').select('*').eq('id', produtoId).single(),
        supabase.from('clients').select('*').eq('email', user.email).single()
      ]);

      if (prodRes.data) setProduct(prodRes.data);
      if (clientRes.data) setClient(clientRes.data);
      
      setLoading(false);
    }
    loadData();
  }, [produtoId]);

  const handleCheckout = async () => {
    if (!product || !client) return;
    
    // Validar Cartão se selecionado
    if (faltante > 0 && paymentMethod === 'cartao') {
      if (!cardData.number || !cardData.holderName || !cardData.expiry || !cardData.ccv || !cardData.postalCode || !cardData.addressNumber) {
        alert("Preencha todos os dados do cartão.");
        return;
      }
    }

    setProcessing(true);
    
    try {
      const payload: any = { 
        produtoId: product.id, 
        clientId: client.id,
        method: faltante > 0 ? paymentMethod : 'cashback',
        forma_entrega: formaEntrega,
        delivery_info: deliveryInfo
      };

      if (paymentMethod === 'cartao' && faltante > 0) {
        const [month, year] = cardData.expiry.split('/');
        payload.creditCard = {
          holderName: cardData.holderName,
          number: cardData.number.replace(/\D/g, ''),
          expiryMonth: month,
          expiryYear: year?.length === 2 ? `20${year}` : year,
          ccv: cardData.ccv
        };
        payload.postalCode = cardData.postalCode;
        payload.addressNumber = cardData.addressNumber;
      }

      const res = await fetch('/api/checkout-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro no checkout");
      
      if (data.type === 'CASHBACK_FULL' || data.type === 'CREDIT_CARD_SUCCESS') {
        setSuccess(true);
      } else if (data.type === 'PIX') {
        setPixData({ payload: data.pixPayload, encodedImage: data.pixEncodedImage });
      }
    } catch (err: any) {
      alert("Erro ao processar compra: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
        <p className="text-gray-500">Produto não encontrado. Volte para a loja.</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const saldo = Number(client?.cashback_saldo || 0);      // Dinheiro real de recarga PIX
  const pontos = Number(client?.pontos || 0);             // Pontos de fidelidade (100pts = R$1)
  const pontosEmReais = pontos / 100;                     // Valor dos pontos em R$
  const price = Number(product.price);
  
  // Abatimento: primeiro usa cashback_saldo (dinheiro real), depois pontos
  const abatimentoCashback = Math.min(saldo, price);
  const restanteAposCashback = price - abatimentoCashback;
  const abatimentoPontos = Math.min(pontosEmReais, restanteAposCashback);
  const totalAbatimento = abatimentoCashback + abatimentoPontos;
  const faltante = Math.max(0, price - totalAbatimento);
  const abatimento = totalAbatimento; // alias

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50">
        <button onClick={() => router.back()} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="font-black text-gray-800 text-lg">Finalizar Compra</h1>
      </div>

      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Pedido Recebido!</h2>
          <p className="text-gray-500 mb-8">A confirmação e a baixa do pedido serão atualizadas automaticamente pela Asaas.</p>
          <button 
            onClick={() => router.push('/app/loja')}
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors"
          >
            Voltar para Loja
          </button>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Produto Resumo */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex gap-4 items-center">
            <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{product.category}</p>
              <h3 className="font-bold text-gray-800 text-sm leading-tight">{product.name}</h3>
              <p className="text-lg font-black text-blue-600">{formatCurrency(price)}</p>
            </div>
          </div>

          {/* Saldo / Abatimento */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <Wallet className="w-5 h-5 text-purple-500" /> Meus Saldos MaisTrilha
            </h3>
            
            {/* Cashback Saldo (Dinheiro Real) */}
            <div className="flex justify-between items-center text-sm bg-green-50 px-3 py-2 rounded-xl">
              <div>
                <span className="text-green-800 font-bold">💳 Saldo Cashback</span>
                <p className="text-xs text-green-600">Dinheiro real (recarga PIX)</p>
              </div>
              <span className="font-bold text-green-800">{formatCurrency(saldo)}</span>
            </div>

            {/* Pontos de Fidelidade */}
            <div className="flex justify-between items-center text-sm bg-amber-50 px-3 py-2 rounded-xl">
              <div>
                <span className="text-amber-800 font-bold">⭐ Pontos de Fidelidade</span>
                <p className="text-xs text-amber-600">{pontos} pts = {formatCurrency(pontosEmReais)} de desconto</p>
              </div>
              <span className="font-bold text-amber-800">{pontos} pts</span>
            </div>

            <div className="h-px bg-gray-100" />
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Valor do Produto:</span>
              <span className="font-bold text-gray-800">{formatCurrency(price)}</span>
            </div>
            
            {abatimentoCashback > 0 && (
              <div className="flex justify-between items-center text-sm text-green-700 font-bold">
                <span>- Saldo Cashback:</span>
                <span>- {formatCurrency(abatimentoCashback)}</span>
              </div>
            )}
            {abatimentoPontos > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-700 font-bold">
                <span>- Desconto Pontos ({Math.ceil(abatimentoPontos * 100)} pts):</span>
                <span>- {formatCurrency(abatimentoPontos)}</span>
              </div>
            )}
            
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-800 font-bold">Total a Pagar:</span>
              <span className="font-black text-xl text-blue-600">{formatCurrency(faltante)}</span>
            </div>
          </div>

          {/* Forma de Entrega */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Opções de Entrega</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => setFormaEntrega("retirada")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'retirada' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span className="block font-bold text-sm mb-1">Retirar na Loja</span>
                <span className="block text-[10px] opacity-80">Grátis</span>
              </button>
              <button 
                onClick={() => setFormaEntrega("entrega_trilha")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'entrega_trilha' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span className="block font-bold text-sm mb-1">Entrega na Trilha</span>
                <span className="block text-[10px] opacity-80">Combinar local</span>
              </button>
              <button 
                onClick={() => setFormaEntrega("correios")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'correios' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span className="block font-bold text-sm mb-1">Correios</span>
                <span className="block text-[10px] opacity-80">A calcular envios</span>
              </button>
            </div>

            {(formaEntrega === 'correios' || formaEntrega === 'entrega_trilha') && (
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-400 uppercase">
                  {formaEntrega === 'correios' ? 'Endereço Completo (CEP, Rua, Número)' : 'Qual trilha/ponto de encontro?'}
                </label>
                <textarea 
                  value={deliveryInfo} onChange={e => setDeliveryInfo(e.target.value)}
                  placeholder={formaEntrega === 'correios' ? 'Ex: Rua XV de Novembro, 100 - Centro, CEP 00000-000' : 'Ex: Trilha da Pedra da Tartaruga, dia 20/10'}
                  className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            )}
          </div>

          {faltante > 0 && !pixData && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm mb-2">Forma de Pagamento</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button 
                  onClick={() => setPaymentMethod("pix")}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'pix' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="font-bold text-sm">Pix</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("cartao")}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'cartao' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
                >
                  <Wallet className="w-5 h-5" />
                  <span className="font-bold text-sm">Cartão</span>
                </button>
              </div>

              {paymentMethod === 'cartao' && (
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Número do Cartão</label>
                    <input 
                      type="text" placeholder="0000 0000 0000 0000" 
                      value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Validade</label>
                      <input 
                        type="text" placeholder="MM/AA" 
                        value={cardData.expiry} onChange={e => setCardData({...cardData, expiry: e.target.value})}
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">CVV</label>
                      <input 
                        type="text" placeholder="123" 
                        value={cardData.ccv} onChange={e => setCardData({...cardData, ccv: e.target.value})}
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Nome no Cartão</label>
                    <input 
                      type="text" placeholder="NOME DO TITULAR" 
                      value={cardData.holderName} onChange={e => setCardData({...cardData, holderName: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">CEP</label>
                      <input
                        type="text" placeholder="00000-000" maxLength={9}
                        value={cardData.postalCode}
                        onChange={e => setCardData({...cardData, postalCode: e.target.value})}
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Número</label>
                      <input
                        type="text" placeholder="123"
                        value={cardData.addressNumber}
                        onChange={e => setCardData({...cardData, addressNumber: e.target.value})}
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {pixData ? (
             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-48 h-48 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code PIX" className="w-full h-full object-contain" />
              </div>
              <p className="text-sm font-bold text-gray-800 mb-2">Escaneie o QR Code ou copie o código</p>
              <p className="text-xs text-gray-500 mb-4">Aguardando confirmação do pagamento...</p>
              
              <button 
                onClick={handleCopy}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-blue-200"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                {copied ? "Código Copiado!" : "Copiar Código Pix"}
              </button>
             </div>
          ) : (
            <button 
              onClick={handleCheckout}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-md transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {processing ? "Processando..." : faltante > 0 ? "Confirmar Pagamento" : "Concluir Compra com Saldo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
