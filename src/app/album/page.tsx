"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, ArrowRight, Loader2, Camera, ShieldCheck } from "lucide-react";

export default function AlbumLoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setLoading(true);
    setMessage(null);
    setEmail(normalizedEmail);
    setToken("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail });

    if (error) {
      setMessage({ type: "error", text: "Não foi possível enviar o código. Tente novamente em instantes." });
    } else {
      setMessage({ type: "success", text: "Código enviado! Use o código mais recente recebido no seu e-mail." });
      setStep(2);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.replace(/\D/g, "");
    if (normalizedToken.length !== 8) {
      setMessage({ type: "error", text: "Digite os 8 dígitos do código recebido por e-mail." });
      return;
    }
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: "email",
    });

    if (error || !data.user) {
      setMessage({
        type: "error",
        text: "Código inválido, expirado ou já utilizado. Solicite um novo código e use somente o mais recente.",
      });
      setLoading(false);
    } else {
      router.push("/album/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1722] text-white flex flex-col items-center justify-center relative overflow-hidden px-4 pt-24 md:pt-32 pb-10">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#F17B37] to-orange-400 p-[2px] rounded-full shadow-[0_0_20px_rgba(241,123,55,0.4)] mb-6">
            <div className="w-full h-full bg-[#0F1722] rounded-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-[#F17B37]" />
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2 tracking-tight text-center">Álbum Premium</h1>
          <p className="text-gray-400 text-center font-medium max-w-xs flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Encontre suas fotos usando IA
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleRequestOTP}
                className="flex flex-col gap-5"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Seu E-mail da Trilha</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                      type="email" 
                      required 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="exemplo@gmail.com" 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F17B37] focus:border-transparent transition-all font-medium"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#F17B37] to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>Acessar Meus Álbuns <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleVerifyOTP}
                className="flex flex-col gap-5"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Código de 8 dígitos</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                      type="text" 
                      required 
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      value={token}
                      onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="00000000" 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F17B37] focus:border-transparent transition-all font-black tracking-widest text-lg"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 flex items-center justify-between">
                    Enviado para {email}
                    <button type="button" onClick={() => setStep(1)} className="text-[#F17B37] font-bold hover:underline">Trocar</button>
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || token.length !== 8}
                  className="w-full bg-gradient-to-r from-[#F17B37] to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>Verificar Código <Lock className="w-5 h-5" /></>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-xl text-sm font-bold border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
            >
              {message.text}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
