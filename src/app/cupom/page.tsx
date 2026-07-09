"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Lock, Unlock, Copy, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import Image from "next/image";

type RevealState = "IDLE" | "LOADING" | "SUCCESS" | "EXHAUSTED" | "ERROR";

export default function CupomVIPPage() {
  const [revealState, setRevealState] = useState<RevealState>("IDLE");
  const [couponCode, setCouponCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Disable scrolling on this specific page to keep it app-like
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const handleReveal = async () => {
    setRevealState("LOADING");

    try {
      const response = await fetch('/api/reveal-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (data.success && data.coupon_code) {
        setCouponCode(data.coupon_code);
        setRevealState("SUCCESS");
        // Trigger confetti
        const duration = 3 * 1000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#F17B37', '#ffffff', '#25D366']
          });
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#F17B37', '#ffffff', '#25D366']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();

      } else if (data.exhausted) {
        setRevealState("EXHAUSTED");
      } else {
        setRevealState("ERROR");
      }
    } catch (error) {
      console.error(error);
      setRevealState("ERROR");
    }
  };

  const copyToClipboard = () => {
    if (couponCode) {
      navigator.clipboard.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F16] flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background Decorativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[200px] opacity-[0.15] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[200px] opacity-[0.1] pointer-events-none" />

      {/* Header Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute top-12 z-20 flex flex-col items-center"
      >
        <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#F17B37] to-[#ffd0b0] shadow-[0_0_30px_rgba(241,123,55,0.4)] mb-4">
           <Image
             src="/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG"
             alt="Mais Trilha Logo"
             width={96}
             height={96}
             className="rounded-full w-full h-full object-cover border-[3px] border-[#0A0F16]"
           />
        </div>
        <h1 className="text-white text-2xl font-black tracking-widest uppercase">Mais Trilha</h1>
      </motion.div>

      {/* Main Container */}
      <div className="w-full max-w-md px-6 z-10 mt-20">
        <AnimatePresence mode="wait">
          
          {/* IDLE STATE */}
          {revealState === "IDLE" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center"
            >
              <div className="bg-[#1A2230]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#F17B37] to-transparent opacity-50" />
                
                <Ticket className="w-16 h-16 text-[#F17B37] mx-auto mb-6" />
                <h2 className="text-3xl font-black text-white mb-3">Baú Secreto</h2>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Encontramos um prêmio! Apenas os <strong className="text-[#F17B37]">2 primeiros</strong> aventureiros vão conseguir resgatar esse desconto exclusivo.
                </p>

                {/* Blured Box */}
                <div className="relative group cursor-pointer mb-8" onClick={handleReveal}>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#F17B37] to-[#f9a03f] opacity-20 blur-xl rounded-2xl group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="relative bg-black/40 border border-[#F17B37]/30 backdrop-blur-md rounded-2xl p-6 overflow-hidden flex items-center justify-center">
                    <span className="text-4xl font-black text-white/10 blur-[8px] select-none tracking-widest">
                      ???CUPOM???
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                      <Lock className="w-8 h-8 text-white/50" />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleReveal}
                  className="w-full bg-[#F17B37] hover:bg-[#d9682b] text-white font-black text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(241,123,55,0.4)] transition-all transform hover:scale-105 active:scale-95"
                >
                  Tentar a Sorte
                </button>
              </div>
            </motion.div>
          )}

          {/* LOADING STATE */}
          {revealState === "LOADING" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="w-16 h-16 text-[#F17B37] animate-spin mb-6" />
              <p className="text-[#F17B37] font-bold text-lg animate-pulse tracking-widest uppercase">
                Verificando baú...
              </p>
            </motion.div>
          )}

          {/* SUCCESS STATE */}
          {revealState === "SUCCESS" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="bg-gradient-to-b from-[#1A2230] to-[#0A0F16] border-2 border-[#F17B37] rounded-3xl p-8 shadow-[0_0_50px_rgba(241,123,55,0.2)] w-full relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#F17B37] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(241,123,55,0.6)]">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                
                <h2 className="text-3xl font-black text-white mt-4 mb-2">Parabéns!</h2>
                <p className="text-gray-300 text-sm mb-8">
                  Você foi um dos 2 aventureiros mais rápidos e garantiu o seu prêmio.
                </p>

                <div className="bg-black/50 border border-dashed border-[#F17B37]/50 rounded-2xl p-6 mb-6 relative group">
                  <span className="text-3xl font-black text-[#F17B37] tracking-wider font-mono">
                    {couponCode}
                  </span>
                </div>

                <button 
                  onClick={copyToClipboard}
                  className={`w-full font-black text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all ${
                    copied 
                    ? 'bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.4)]' 
                    : 'bg-white text-[#0A0F16] hover:bg-gray-200 shadow-xl'
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-6 h-6" /> Copiar Código
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* EXHAUSTED STATE */}
          {revealState === "EXHAUSTED" && (
            <motion.div
              key="exhausted"
              initial={{ opacity: 0, x: [0, -10, 10, -10, 10, 0] }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="bg-[#1A2230]/50 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 shadow-2xl w-full">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">Baú Vazio!</h2>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Que pena! Outros aventureiros foram mais rápidos e esgotaram os 2 cupons disponíveis.
                </p>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-center justify-center gap-3">
                  <Lock className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-500 font-black tracking-widest line-through">
                    CÓDIGO SECRETO
                  </span>
                </div>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Voltar para o Início
                </button>
              </div>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {revealState === "ERROR" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center bg-[#1A2230] p-8 rounded-3xl border border-white/10"
            >
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Erro de Conexão</h2>
              <p className="text-gray-400 text-sm mb-6">
                Não conseguimos validar o baú agora. Tente novamente mais tarde.
              </p>
              <button 
                onClick={() => setRevealState("IDLE")}
                className="bg-white/10 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/20 transition-all"
              >
                Tentar Novamente
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      
      {/* Footer minimalista */}
      <div className="absolute bottom-6 text-center w-full z-10">
        <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Mais Trilha Menos Estresse</p>
      </div>
    </div>
  );
}
