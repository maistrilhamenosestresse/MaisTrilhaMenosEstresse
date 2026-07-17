"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { MapPin, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { REQUIRED_PAID_TRAILS } from "@/lib/member-access";

export default function AppLoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setMessage(null);

    let eligibilityResponse: Response;
    try {
      eligibilityResponse = await fetch('/api/auth/client-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      setMessage({ type: "error", text: "Não foi possível verificar seu acesso. Confira sua conexão e tente novamente." });
      setLoading(false);
      return;
    }

    if (!eligibilityResponse.ok) {
      setMessage({ type: "error", text: "Não foi possível verificar seu acesso agora. Tente novamente em instantes." });
      setLoading(false);
      return;
    }

    const eligibility = await eligibilityResponse.json();
    if (!eligibility.registered) {
      setMessage({ type: "error", text: "Não encontramos uma compra vinculada a este e-mail. Confira o endereço digitado." });
      setLoading(false);
      return;
    }

    if (!eligibility.eligible) {
      setMessage({
        type: "error",
        text: `A Área de Membros é liberada após ${REQUIRED_PAID_TRAILS} trilhas pagas. Continue suas aventuras para desbloquear o acesso.`,
      });
      setLoading(false);
      return;
    }

    const supabase = createClient();
    // Para clientes válidos com acesso à Área de Membros, enviamos o OTP.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {}
    });

    if (error) {
      console.error("Supabase Auth Error:", error);
      setMessage({ type: "error", text: `Erro ao enviar o código (${error.message}). Tente novamente.` });
    } else {
      setMessage({ type: "success", text: "Código enviado! Verifique sua caixa de entrada (e Spam)." });
      setStep(2);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token.length < 8) return;

    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      // Tentar outras abordagens de fallback se o primeiro falhar
      const retry1 = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'magiclink'
      });
      data = retry1.data;
      error = retry1.error;
    }

    if (error) {
      const retry2 = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });
      data = retry2.data;
      error = retry2.error;
    }

    if (error) {
      console.error("Supabase Verify Error:", error);
      setMessage({ type: "error", text: `Código inválido ou expirado. Tente pedir um novo código.` });
      setLoading(false);
    } else if (data?.session) {
      setMessage({ type: "success", text: "Tudo pronto! Entrando nas suas aventuras..." });
      const profileResponse = await fetch('/api/clients/me', { cache: 'no-store' });
      if (!profileResponse.ok) {
        await supabase.auth.signOut();
        setMessage({ type: 'error', text: 'Seu cadastro não pôde ser vinculado ao acesso. Fale com o suporte.' });
        setLoading(false);
        return;
      }
      router.push("/app");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decoração Premium */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-500 opacity-10 blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500 opacity-10 blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-800">MaisTrilha<span className="text-purple-600">.</span></h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Sua Área do Aventureiro</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5" 
                onSubmit={handleRequestOTP}
              >
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Qual e-mail você usou na compra?
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                    placeholder="seu@email.com.br"
                  />
                </div>

                {message && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    "Enviando..."
                  ) : (
                    <>
                      Entrar no App <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5" 
                onSubmit={handleVerifyOTP}
              >
                <div className="text-center mb-6">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">Código de Acesso</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Enviamos uma chave mágica de 8 dígitos para<br />
                    <strong className="text-purple-600">{email}</strong>
                  </p>
                </div>

                <div>
                  <input
                    id="token"
                    type="text"
                    required
                    maxLength={8}
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-2xl tracking-[0.4em] font-black text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                    placeholder="00000000"
                  />
                </div>

                {message && (
                  <div className={`p-3 rounded-xl text-xs font-bold text-center ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || token.length < 8}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Verificando..." : "Confirmar e Entrar"}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="w-full text-xs font-bold text-gray-400 hover:text-purple-600 py-2 transition-colors"
                >
                  Usar outro e-mail
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        
        <p className="text-center text-xs text-gray-400 mt-6 font-medium">
          Acesso seguro e sem senhas complicadas.
        </p>
      </div>
    </div>
  );
}
