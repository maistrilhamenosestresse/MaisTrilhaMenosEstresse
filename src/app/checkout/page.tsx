"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { calculateGrossPrice } from "@/lib/fees";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, CheckCircle2, Loader2, ArrowRight, User as UserIcon, ArrowLeft, Save, QrCode, FileText, CreditCard } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import Image from "next/image";
import {
  AsaasPaymentStatus,
  type AsaasPaymentResult,
} from "@/components/payments/AsaasPaymentStatus";
import { BoletoInstallmentSelector } from "@/components/payments/BoletoInstallmentSelector";
import { CancellationAcceptance } from "@/components/legal/CancellationAcceptance";

function CheckoutAuthContent() {
  const router = useRouter();
  const { items, clearCart } = useCartStore();

  const cartNetTotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const [boletoInstallments, setBoletoInstallments] = useState(1);
  const [acceptedCancellation, setAcceptedCancellation] = useState(false);

  const calculateTotalWithMethod = (method: 'INFINITEPAY' | 'BOLETO') =>
    method === 'BOLETO'
      ? calculateGrossPrice(cartNetTotal, 'BOLETO', boletoInstallments)
      : cartNetTotal;
  
  const [step, setStep] = useState<'email' | 'otp' | 'cart' | 'edit' | 'payment' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'INFINITEPAY' | 'BOLETO'>('INFINITEPAY');
  const [livePaymentMethods, setLivePaymentMethods] = useState<Record<string, string[]>>({});
  
  // Calculate allowed payment methods (intersection of all items in cart)
  const acceptedLegacyMethods = useMemo(() => items.reduce<string[]>((acc, item) => {
    const methods = livePaymentMethods[item.agendaId] || item.acceptedPaymentMethods || ['PIX'];
    const normalized = methods.length > 0 ? methods : ['PIX'];
    return acc.filter((method) => normalized.includes(method));
  }, ['PIX', 'CREDIT_CARD', 'BOLETO']), [items, livePaymentMethods]);
  const allowedMethods = useMemo<Array<'INFINITEPAY' | 'BOLETO'>>(
    () => [
      ...(acceptedLegacyMethods.some((method) => method === 'PIX' || method === 'CREDIT_CARD')
        ? ['INFINITEPAY' as const]
        : []),
      ...(acceptedLegacyMethods.includes('BOLETO') ? ['BOLETO' as const] : []),
    ],
    [acceptedLegacyMethods],
  );

  useEffect(() => {
    const agendaIds = [...new Set(items.map((item) => item.agendaId))];
    if (!agendaIds.length) return;
    supabase
      .from('agendas')
      .select('id, accepted_payment_methods')
      .in('id', agendaIds)
      .then(({ data }) => {
        const current = Object.fromEntries((data || []).map((agenda: any) => [
          agenda.id,
          Array.isArray(agenda.accepted_payment_methods) && agenda.accepted_payment_methods.length
            ? agenda.accepted_payment_methods
            : ['PIX'],
        ]));
        setLivePaymentMethods(current);
      });
  }, [items]);

  useEffect(() => {
    if (!allowedMethods.includes(paymentMethod) && allowedMethods.length > 0) {
      setPaymentMethod(allowedMethods.includes('INFINITEPAY') ? 'INFINITEPAY' : allowedMethods[0]);
    }
  }, [allowedMethods, paymentMethod]);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  useEffect(() => {
    if (items.length === 0 && step !== 'success') {
      router.push('/');
      return;
    }
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const response = await fetch('/api/clients/me', { cache: 'no-store' });
        if (response.ok) {
          const { client } = await response.json();
          setClientData(client);
          setStep((prev) => prev === 'email' ? 'cart' : prev);
        }
      }
      setIsInitializing(false);
    };
    checkSession();
  }, [items.length, router, step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const eligibilityResponse = await fetch('/api/auth/client-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const eligibility = eligibilityResponse.ok ? await eligibilityResponse.json() : { registered: false };
    if (!eligibility.registered) {
      setIsLoading(false);
      router.push(`/cadastro?email=${encodeURIComponent(email)}`);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail });
    setIsLoading(false);
    if (error) {
      alert("Erro ao enviar código: " + error.message);
    } else {
      setStep('otp');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    let { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: 'email' });
    if (error) {
      const retry1 = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: 'magiclink' });
      error = retry1.error;
    }
    setIsLoading(false);
    if (error) {
      alert("Código inválido ou expirado.");
    } else {
      const response = await fetch('/api/clients/me', { cache: 'no-store' });
      if (!response.ok) {
        alert("Não foi possível carregar seu cadastro.");
        return;
      }
      const { client } = await response.json();
      setClientData(client);
      setStep('cart');
    }
  };

  const openEdit = () => {
    setEditForm({ ...clientData });
    setStep('edit');
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/clients/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao atualizar cadastro');
      setClientData(result.client);
      setStep('cart');
    } catch {
      alert("Erro ao salvar os dados.");
    }
    setIsLoading(false);
  };

  const processPayment = async () => {
    setIsLoading(true);
    try {
      const resReserva = await fetch('/api/create-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            agendaId: item.agendaId,
            dependents: item.dependents || [],
          })),
        }),
      });
      const reservaJson = await resReserva.json();
      if (!resReserva.ok) throw new Error(reservaJson.error || "Erro ao criar reserva");
      const reservaIds = reservaJson.reservas.map((r: any) => r.id);

      const reqCheckout = await fetch('/api/checkout-asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva_ids: reservaIds,
          customer_data: {
            name: clientData.full_name,
            email: clientData.email,
            cpf: clientData.cpf,
            phone: clientData.phone,
            postalCode: clientData.postalCode || '01310000',
            addressNumber: clientData.addressNumber || '1'
          },
          payment_method: paymentMethod,
          installments: paymentMethod === 'BOLETO' ? boletoInstallments : 1,
        })
      });

      const resCheckout = await reqCheckout.json();
      
      if (resCheckout.success) {
        if (resCheckout.provider === "INFINITEPAY" && resCheckout.redirectUrl && resCheckout.orderNsu) {
          window.sessionStorage.setItem(
            `infinitepay:${resCheckout.orderNsu}:returnTo`,
            "/",
          );
          window.sessionStorage.setItem(
            `infinitepay:${resCheckout.orderNsu}:invitations`,
            JSON.stringify(reservaJson.invitations || []),
          );
          clearCart();
          window.location.assign(resCheckout.redirectUrl);
          return;
        }
        if (resCheckout.provider !== "ASAAS" || !resCheckout.paymentId) {
          throw new Error("Resposta inválida do Asaas.");
        }
        setPaymentResult({
          ...resCheckout,
          invitations: reservaJson.invitations || [],
        } as AsaasPaymentResult & { invitations: any[] });
        clearCart();
        setStep('success');
      } else {
        throw new Error(resCheckout.error || "Pagamento recusado.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Ocorreu um erro no pagamento: " + err.message);
    }
    setIsLoading(false);
  };

  if (isInitializing) {
    return <div className="min-h-screen bg-[#0F1722] flex items-center justify-center"><Loader2 className="animate-spin text-[#F17B37] w-8 h-8" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-5 pointer-events-none" />
      
      <div className="w-full max-w-lg relative z-10">
        <AnimatePresence mode="wait">
          
          {/* Email Step */}
          {step === 'email' && (
            <motion.form key="email" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleSendOtp} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-md shadow-2xl relative">
              <button type="button" onClick={() => router.push('/carrinho')} className="absolute top-6 left-6 text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center mb-8 mt-4">
                <div className="w-16 h-16 bg-[#F17B37]/10 text-[#F17B37] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F17B37]/20"><UserIcon className="h-7 w-7" /></div>
                <h1 className="text-2xl font-bold mb-2">Checkout Seguro</h1>
                <p className="text-gray-400 text-sm">Insira seu e-mail para continuar com a sua reserva.</p>
              </div>
              <div className="mb-6">
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 p-4 bg-[#0F1722]/50 border border-white/10 rounded-2xl focus:ring-1 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" placeholder="email@exemplo.com" />
                </div>
              </div>
              <button type="submit" disabled={isLoading || !email} className="w-full bg-[#F17B37] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#d9682b] transition disabled:opacity-50">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuar <ArrowRight className="h-5 w-5" /></>}
              </button>
            </motion.form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <motion.form key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerifyOtp} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-md shadow-2xl relative">
              <button type="button" onClick={() => setStep('email')} className="absolute top-6 left-6 text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center mb-8 mt-4">
                <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#25D366]/20"><KeyRound className="h-7 w-7" /></div>
                <h1 className="text-2xl font-bold mb-2">Código Enviado!</h1>
                <p className="text-gray-400 text-sm">Enviamos um código para o e-mail <strong>{email}</strong>.</p>
              </div>
              <div className="mb-6">
                <input type="text" required maxLength={8} value={otp} onChange={e => setOtp(e.target.value)} className="w-full p-4 bg-[#0F1722]/50 border border-white/10 rounded-2xl focus:ring-1 focus:ring-[#F17B37] outline-none transition-all text-center tracking-[1em] text-xl font-bold" placeholder="00000000" />
              </div>
              <button type="submit" disabled={isLoading || otp.length < 8} className="w-full bg-[#F17B37] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#d9682b] transition disabled:opacity-50">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verificar Código</>}
              </button>
            </motion.form>
          )}

          {/* Cart Confirmation Step */}
          {step === 'cart' && clientData && (
            <motion.div key="cart" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative w-full">
              <button type="button" onClick={() => router.push('/carrinho')} className="absolute top-6 left-6 text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center mb-6 mt-4">
                <h1 className="text-2xl font-bold mb-1">Confirme seus dados</h1>
                <p className="text-gray-400 text-sm">Verifique tudo antes de pagar, {clientData?.full_name?.split(' ')[0] || 'Aventureiro'}!</p>
              </div>

              <div className="bg-[#0F1722]/50 border border-white/10 p-4 rounded-2xl mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {clientData?.photo_url ? (
                    <Image
                      src={clientData.photo_url}
                      alt="Cliente"
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded-full border border-white/20 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#F17B37]/20 flex items-center justify-center text-[#F17B37]"><UserIcon /></div>
                  )}
                  <div>
                    <p className="font-bold text-sm leading-tight text-white">{clientData?.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-gray-400 mt-1">{clientData?.cpf || 'CPF não cadastrado'}</p>
                  </div>
                </div>
                <button onClick={openEdit} className="text-xs text-[#F17B37] hover:underline font-bold bg-white/5 px-3 py-2 rounded-xl border border-white/5">Editar</button>
              </div>

              <div className="flex justify-between items-center mb-4 text-gray-400 text-sm">
                <span>Subtotal ({items.length} itens)</span>
                <span>R$ {cartNetTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="border-t border-white/10 my-4"></div>

              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-gray-300">
                  Total ({paymentMethod === 'INFINITEPAY' ? 'Pix ou cartão' : 'boleto'})
                </span>
                <span className="text-2xl font-black text-[#25D366]">
                  R$ {calculateTotalWithMethod(paymentMethod).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <button onClick={() => {
                if (!clientData?.cpf || clientData.cpf.replace(/\D/g, '').length < 11) {
                  alert("Para gerar a cobrança, é obrigatório ter um CPF válido. Clique em 'Editar' e adicione seu CPF.");
                  openEdit();
                  return;
                }
                setStep('payment');
              }} className="w-full bg-gradient-to-r from-[#25D366] to-[#20b858] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-[0_0_20px_rgba(37,211,102,0.3)]">
                Avançar para Pagamento <ArrowRight className="h-5 w-5" />
              </button>
            </motion.div>
          )}

          {/* Payment Method Step */}
          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative w-full">
              <button type="button" onClick={() => setStep('cart')} className="absolute top-6 left-6 text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center mb-6 mt-4">
                <h1 className="text-2xl font-bold mb-1">Pagamento Seguro</h1>
                <p className="text-gray-400 text-sm">Escolha como deseja pagar.</p>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {allowedMethods.includes('INFINITEPAY') && (
                  <button onClick={() => setPaymentMethod('INFINITEPAY')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'INFINITEPAY' ? 'bg-[#0B2540] border-blue-300 text-white' : 'bg-[#0F1722]/50 border-white/10 text-gray-400'}`}>
                    <span className="flex items-center gap-2">
                      <QrCode className="w-6 h-6" />
                      <CreditCard className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-bold">Pix ou cartão</span>
                    <span className="text-[10px] opacity-70">InfinitePay · cartão em até 12x</span>
                  </button>
                )}
                {allowedMethods.includes('BOLETO') && (
                  <button onClick={() => setPaymentMethod('BOLETO')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'BOLETO' ? 'bg-[#0B2540] border-blue-300 text-white' : 'bg-[#0F1722]/50 border-white/10 text-gray-400'}`}>
                    <FileText className="w-6 h-6" />
                    <span className="text-xs font-bold">Boleto</span>
                    <span className="text-[10px] opacity-70">Asaas · em até 12x</span>
                  </button>
                )}
              </div>

              {paymentMethod === 'BOLETO' && (
                <div className="mb-4">
                  <BoletoInstallmentSelector
                    netAmount={cartNetTotal}
                    installments={boletoInstallments}
                    onChange={setBoletoInstallments}
                    dark
                  />
                </div>
              )}

              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <span className="text-sm text-white">Total da cobrança:</span>
                  <span className="font-bold text-white text-lg">
                    R$ {calculateTotalWithMethod(paymentMethod).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {paymentMethod === 'INFINITEPAY'
                    ? 'Você escolherá Pix ou cartão no checkout seguro da InfinitePay.'
                    : 'O boleto será emitido e confirmado pelo Asaas.'}
                </p>
              </motion.div>

              <div className="mb-4">
                <CancellationAcceptance
                  checked={acceptedCancellation}
                  onChange={setAcceptedCancellation}
                  dark
                />
              </div>

              <button onClick={processPayment} disabled={isLoading || !acceptedCancellation} className="w-full bg-[#F17B37] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-[0_0_20px_rgba(241,123,55,0.3)] disabled:opacity-50">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Finalizar Pedido</>}
              </button>
            </motion.div>
          )}

          {/* Success / Pix / Boleto View */}
          {step === 'success' && paymentResult && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative w-full text-center">
              
              <AsaasPaymentStatus
                payment={paymentResult as AsaasPaymentResult}
                onConfirmed={() => setPaymentConfirmed(true)}
              />

              {paymentConfirmed && paymentResult.invitations?.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 text-left">
                  <h2 className="font-bold text-orange-300 mb-2">Cadastro dos acompanhantes</h2>
                  <p className="text-xs text-gray-300 mb-3">Envie cada link à pessoa correspondente. O convite expira em 14 dias.</p>
                  <div className="space-y-2">
                    {paymentResult.invitations.map((invite: any) => (
                      <button
                        key={invite.token}
                        onClick={() => {
                          const link = `${window.location.origin}/cadastro?invite=${encodeURIComponent(invite.token)}`;
                          navigator.clipboard.writeText(link);
                          alert(`Link de ${invite.name} copiado!`);
                        }}
                        className="w-full bg-white/10 hover:bg-white/15 rounded-xl p-3 text-sm font-bold text-left"
                      >
                        Copiar link de {invite.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => router.push('/')} className="w-full bg-white/10 text-white p-4 rounded-2xl font-bold hover:bg-white/20 transition">
                Voltar para o Início
              </button>
            </motion.div>
          )}

          {/* Edit Step */}
          {step === 'edit' && (
            <motion.form key="edit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={saveEdit} className="bg-[#1a2332] border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl relative w-full">
              <button type="button" onClick={() => setStep('cart')} className="absolute top-6 left-6 text-gray-400 hover:text-white transition z-20">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center mb-6 mt-4">
                <h1 className="text-2xl font-bold mb-1">Atualizar Dados</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Nome Completo</label>
                  <input type="text" required value={editForm.full_name || ''} onChange={e => setEditForm({...editForm, full_name: e.target.value})} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">E-mail</label>
                  <input type="email" readOnly value={editForm.email || ''} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none opacity-50 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">CPF (Obrigatório para Pagamento)</label>
                  <input type="text" required maxLength={14} value={editForm.cpf || ''} onChange={e => setEditForm({...editForm, cpf: e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})} placeholder="000.000.000-00" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#F17B37]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Telefone / WhatsApp</label>
                  <input type="tel" required value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none" />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full mt-6 bg-[#F17B37] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> Salvar Alterações</>}
              </button>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CheckoutAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1722] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#F17B37]" /></div>}>
      <CheckoutAuthContent />
    </Suspense>
  );
}
