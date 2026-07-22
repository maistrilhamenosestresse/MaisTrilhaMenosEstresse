"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, QrCode, CheckCircle2, Loader2, Wallet, CreditCard, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { calculateGrossPrice } from "@/lib/fees";
import {
  AsaasPaymentStatus,
  type AsaasPaymentResult,
} from "@/components/payments/AsaasPaymentStatus";
import { BoletoInstallmentSelector } from "@/components/payments/BoletoInstallmentSelector";
import { fetchCurrentClient } from "@/lib/app/current-client";
import { discountToPoints, pointsToDiscount } from "@/lib/gamification";

export default function LojaCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const produtoId = searchParams.get("produtoId");
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"infinitepay" | "boleto">("infinitepay");
  const [boletoInstallments, setBoletoInstallments] = useState(1);
  const [paymentResult, setPaymentResult] = useState<AsaasPaymentResult | null>(null);

  const [formaEntrega, setFormaEntrega] = useState<"retirada" | "correios" | "entrega_trilha">("retirada");
  const [deliveryInfo, setDeliveryInfo] = useState("");

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
        fetchCurrentClient<any>(),
      ]);

      if (prodRes.data) setProduct(prodRes.data);
      if (clientRes) setClient(clientRes);
      
      setLoading(false);
    }
    loadData();
  }, [produtoId]);

  const handleCheckout = async () => {
    if (!product || !client) return;
    
    setProcessing(true);
    
    try {
      const payload: any = { 
        produtoId: product.id, 
        clientId: client.id,
        method: faltante > 0 ? paymentMethod : 'cashback',
        installments: faltante > 0 && paymentMethod === "boleto" ? boletoInstallments : 1,
        forma_entrega: formaEntrega,
        delivery_info: deliveryInfo
      };

      const res = await fetch('/api/checkout-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro no pagamento");
      
      if (data.type === 'CASHBACK_FULL') {
        setSuccess(true);
      } else if (data.provider === "INFINITEPAY" && data.redirectUrl && data.orderNsu) {
        window.sessionStorage.setItem(
          `infinitepay:${data.orderNsu}:returnTo`,
          "/app/loja",
        );
        window.location.assign(data.redirectUrl);
      } else if (data.provider === "ASAAS" && data.paymentId) {
        setPaymentResult(data as AsaasPaymentResult);
      } else {
        throw new Error("Resposta inválida do provedor de pagamento");
      }
    } catch (err: any) {
      alert("Erro ao processar compra: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center p-6 text-center">
        <p className="text-gray-500">Produto não encontrado. Volte para a loja.</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const saldo = Number(client?.cashback_saldo || 0);      // Dinheiro real de recarga PIX
  const pontos = Number(client?.pontos || 0);
  const descontoDisponivelEmPontos = pointsToDiscount(pontos);
  const price = Number(product.price);
  
  // Abatimento: primeiro usa cashback_saldo (dinheiro real), depois pontos
  const abatimentoCashback = Math.min(saldo, price);
  const restanteAposCashback = price - abatimentoCashback;
  const abatimentoPontos = Math.min(descontoDisponivelEmPontos, restanteAposCashback);
  const totalAbatimento = abatimentoCashback + abatimentoPontos;
  const faltante = Math.max(0, price - totalAbatimento);
  const chargedAmount = faltante <= 0
    ? 0
    : paymentMethod === "boleto"
      ? calculateGrossPrice(faltante, "BOLETO", boletoInstallments)
      : faltante;

  if (paymentResult) {
    return (
      <div className="mt-app-page min-h-full p-4 pb-28 sm:p-6">
        <button
          type="button"
          onClick={() => setPaymentResult(null)}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0B2540]"
        >
          <ChevronLeft className="h-5 w-5" />
          Voltar
        </button>
        <AsaasPaymentStatus
          payment={paymentResult}
          onConfirmed={() => {
            setPaymentResult(null);
            setSuccess(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-app-page relative flex min-h-full flex-col pb-24">
      {/* Header */}
      <div className="mt-app-header sticky top-0 z-50 flex items-center gap-4 border-b px-4 py-3">
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
          <p className="text-gray-500 mb-8">Seu pedido foi pago integralmente com saldo e pontos.</p>
          <button
            onClick={() => router.push('/app/loja')}
            className="w-full max-w-xs rounded-2xl bg-[#0B2540] py-4 font-bold text-white transition-colors hover:bg-[#061B30]"
          >
            Voltar para Loja
          </button>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          {/* Produto Resumo */}
          <div className="mt-surface flex items-center gap-4 rounded-3xl p-4">
            <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{product.category}</p>
              <h3 className="font-bold text-gray-800 text-sm leading-tight">{product.name}</h3>
              <p className="text-lg font-black text-[#D96224]">{formatCurrency(price)}</p>
            </div>
          </div>

          {/* Saldo / Abatimento */}
          <div className="mt-surface space-y-3 rounded-3xl p-5 sm:p-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <Wallet className="w-5 h-5 text-[#0B2540]" /> Meus saldos MaisTrilha
            </h3>
            
            {/* Cashback Saldo (Dinheiro Real) */}
            <div className="flex justify-between items-center text-sm bg-green-50 px-3 py-2 rounded-xl">
              <div>
                <span className="text-green-800 font-bold">💳 Saldo disponível</span>
                <p className="text-xs text-green-600">Dinheiro real (recarga PIX)</p>
              </div>
              <span className="font-bold text-green-800">{formatCurrency(saldo)}</span>
            </div>

            {/* Pontos de Fidelidade */}
            <div className="flex justify-between items-center text-sm bg-amber-50 px-3 py-2 rounded-xl">
              <div>
                <span className="text-amber-800 font-bold">⭐ Pontos de Fidelidade</span>
                <p className="text-xs text-amber-600">{pontos} pts = até {formatCurrency(descontoDisponivelEmPontos)} de desconto</p>
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
                <span>- Saldo utilizado:</span>
                <span>- {formatCurrency(abatimentoCashback)}</span>
              </div>
            )}
            {abatimentoPontos > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-700 font-bold">
                <span>- Desconto em pontos ({discountToPoints(abatimentoPontos)} pts):</span>
                <span>- {formatCurrency(abatimentoPontos)}</span>
              </div>
            )}
            
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-800 font-bold">Total a Pagar:</span>
              <span className="text-xl font-black text-[#D96224]">{formatCurrency(faltante)}</span>
            </div>
          </div>

          {/* Forma de Entrega */}
          <div className="mt-surface space-y-4 rounded-3xl p-5 sm:p-6">
            <h3 className="font-bold text-gray-800 text-sm">Opções de Entrega</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => setFormaEntrega("retirada")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'retirada' ? 'border-[#F17B37] bg-[#FFF0E6] text-[#B84D18]' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span className="block font-bold text-sm mb-1">Retirar na Loja</span>
                <span className="block text-[10px] opacity-80">Grátis</span>
              </button>
              <button 
                onClick={() => setFormaEntrega("entrega_trilha")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'entrega_trilha' ? 'border-[#F17B37] bg-[#FFF0E6] text-[#B84D18]' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span className="block font-bold text-sm mb-1">Entrega na Trilha</span>
                <span className="block text-[10px] opacity-80">Combinar local</span>
              </button>
              <button 
                onClick={() => setFormaEntrega("correios")}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${formaEntrega === 'correios' ? 'border-[#F17B37] bg-[#FFF0E6] text-[#B84D18]' : 'border-gray-100 bg-white text-gray-500'}`}
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

          {faltante > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm mb-2">Forma de Pagamento</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    value: "infinitepay" as const,
                    label: "Pix ou cartão",
                    detail: "InfinitePay · cartão em até 12x",
                    icon: (
                      <span className="flex items-center gap-1">
                        <QrCode className="h-5 w-5" />
                        <CreditCard className="h-5 w-5" />
                      </span>
                    ),
                  },
                  {
                    value: "boleto" as const,
                    label: "Boleto",
                    detail: "Asaas · à vista ou em até 12x",
                    icon: <FileText className="h-5 w-5" />,
                  },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setPaymentMethod(option.value)}
                    className={`rounded-2xl border p-3 text-left ${
                      paymentMethod === option.value
                        ? "border-[#0B2540] bg-[#E7EEF6] text-[#0B2540]"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {option.icon}
                    <span className="mt-2 block text-xs font-black">{option.label}</span>
                    <span className="mt-1 block text-[10px] opacity-70">{option.detail}</span>
                  </button>
                ))}
              </div>
              {paymentMethod === "boleto" && (
                <BoletoInstallmentSelector
                  netAmount={faltante}
                  installments={boletoInstallments}
                  onChange={setBoletoInstallments}
                />
              )}
              <div className="rounded-2xl bg-[#071829] p-4 text-white">
                <div className="flex justify-between text-sm">
                  <span>
                    Total {paymentMethod === "boleto" ? "no boleto Asaas" : "na InfinitePay"}
                  </span>
                  <strong>{formatCurrency(chargedAmount)}</strong>
                </div>
                <p className="mt-2 text-[11px] text-blue-100/70">
                  {paymentMethod === "boleto"
                    ? "O boleto inclui a tarifa necessária para preservar o valor líquido do pedido."
                    : "Na próxima etapa você escolhe Pix ou cartão no checkout seguro da InfinitePay."}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={processing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-4 font-bold text-white shadow-md transition-colors hover:bg-[#061B30] disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {processing
              ? "Preparando pagamento..."
              : faltante > 0
                ? paymentMethod === "boleto"
                  ? "Gerar boleto no Asaas"
                  : "Continuar na InfinitePay"
                : "Concluir compra com saldo"}
          </button>
        </div>
      )}
    </div>
  );
}
