"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Copy, CheckCircle2, ShieldAlert, Sparkles, Loader2, User, Flame, Lock, CloudFog } from "lucide-react";
import confetti from "canvas-confetti";
import Image from "next/image";

type RevealState = "IDLE" | "LOADING" | "SUCCESS" | "EXHAUSTED" | "ERROR";

export default function CupomVIPPage() {
  const [revealState, setRevealState] = useState<RevealState>("IDLE");
  const [couponCode, setCouponCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [personName, setPersonName] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const handleReveal = async () => {
    if (!personName.trim()) {
      alert("Por favor, preencha o seu nome para tentar abrir o baú!");
      return;
    }

    setIsFetching(true);

    try {
      const response = await fetch('/api/reveal-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personName })
      });

      const data = await response.json();

      if (data.success && data.coupon_code) {
        setCouponCode(data.coupon_code);
        setRevealState("SUCCESS");
        
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
    } finally {
      setIsFetching(false);
    }
  };

  const copyToClipboard = () => {
    if (couponCode) {
      navigator.clipboard.writeText(couponCode);
      setCopied(true);
      // Redireciona o usuário para a agenda 1.5 segundos após copiar o cupom
      setTimeout(() => {
        window.location.href = '/agenda';
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F16] flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Animação simplificada do botão Neon */}
      <style dangerouslySetInnerHTML={{__html: `
        .btn-neon {
          background: linear-gradient(90deg, #F17B37, #f9a03f, #F17B37);
          background-size: 200% auto;
          animation: gradientPulse 3s infinite linear;
          box-shadow: 0 0 20px rgba(241,123,55,0.4), inset 0 0 10px rgba(255,255,255,0.2);
        }
        .btn-neon:hover {
          box-shadow: 0 0 30px rgba(241,123,55,0.8), inset 0 0 15px rgba(255,255,255,0.5);
          text-shadow: 0 0 5px rgba(255,255,255,0.8);
        }
        @keyframes gradientPulse {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}} />

      {/* Background Decorativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[200px] opacity-[0.15] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[200px] opacity-[0.1] pointer-events-none" />

      {/* Header Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute top-8 z-20 flex flex-col items-center"
      >
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full p-1 bg-gradient-to-tr from-[#F17B37] to-[#ffd0b0] shadow-[0_0_30px_rgba(241,123,55,0.4)] mb-4">
           <Image
             src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG"
             alt="Mais Trilha Logo"
             width={96}
             height={96}
             className="rounded-full w-full h-full object-cover border-[3px] border-[#0A0F16]"
           />
        </div>
        <h1 className="text-white text-xl md:text-2xl font-black tracking-widest uppercase">Mais Trilha</h1>
      </motion.div>

      {/* Main Container */}
      <div className="w-full max-w-md px-6 z-10 mt-20 md:mt-24">
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
              <div className="bg-[#1A2230]/50 backdrop-blur-xl border border-[#F17B37]/20 rounded-3xl p-6 md:p-8 shadow-2xl w-full relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#F17B37] to-transparent opacity-50" />
                
                <Flame className="w-12 h-12 text-[#F17B37] mx-auto mb-4 drop-shadow-[0_0_15px_rgba(241,123,55,0.8)]" />
                <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-wide">Baú Secreto</h2>
                <p className="text-gray-400 text-xs md:text-sm mb-6 leading-relaxed">
                  Apenas as <strong className="text-[#F17B37]">2 primeiras</strong> pessoas vão conseguir abrir a névoa e resgatar este super cupom de desconto.
                </p>

                {/* Caixa Bloqueada Simples */}
                <div className="relative mb-8 w-full h-24 bg-black/40 border border-[#F17B37]/30 backdrop-blur-md rounded-2xl p-6 overflow-hidden flex items-center justify-center">
                  <span className="text-3xl font-black text-white/10 blur-[8px] select-none tracking-widest relative z-0">
                    ???CUPOM???
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-8 h-8 text-[#F17B37]/50" />
                  </div>
                </div>

                {/* Input de Nome */}
                <div className="relative mb-6">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <input 
                    type="text" 
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="Digite seu nome para tentar abrir"
                    className="w-full bg-black/30 border border-white/10 text-white rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#F17B37] focus:ring-1 focus:ring-[#F17B37] transition-all placeholder-gray-600 font-bold text-sm"
                  />
                </div>

                <button 
                  onClick={handleReveal}
                  disabled={isFetching}
                  className="w-full btn-neon text-white font-black text-lg py-4 rounded-xl transition-all transform hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isFetching ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Verificando...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> Testar Sorte</>
                  )}
                </button>

                <button 
                  onClick={() => window.location.href = '/agenda'}
                  disabled={isFetching}
                  className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
                >
                  Ver Trilhas Disponíveis
                </button>
              </div>
            </motion.div>
          )}

          {/* SUCCESS STATE */}
          {revealState === "SUCCESS" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="bg-gradient-to-b from-[#1A2230] to-[#0A0F16] border-2 border-[#F17B37] rounded-3xl p-8 shadow-[0_0_50px_rgba(241,123,55,0.3)] w-full relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#F17B37] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(241,123,55,0.8)]">
                  <Ticket className="w-6 h-6 text-white" />
                </div>
                
                <h2 className="text-3xl font-black text-white mt-4 mb-2">Você Conseguiu!</h2>
                <p className="text-gray-300 text-sm mb-8 leading-relaxed">
                  <strong className="text-[#F17B37]">{personName}</strong>, você foi rápido! Este é o seu código secreto único. Não o perca!
                </p>

                <div className="bg-black/80 border-2 border-dashed border-[#F17B37] rounded-2xl p-6 mb-8 relative group">
                  <span className="text-2xl md:text-3xl font-black text-white tracking-wider font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    {couponCode}
                  </span>
                </div>

                <button 
                  onClick={copyToClipboard}
                  className={`w-full font-black text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all ${
                    copied 
                    ? 'bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.4)]' 
                    : 'bg-white text-[#0A0F16] hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105'
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
              <div className="bg-[#1A2230]/50 backdrop-blur-xl border border-red-500/50 rounded-3xl p-8 shadow-[0_0_40px_rgba(239,68,68,0.2)] w-full">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                  <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                  <ShieldAlert className="w-10 h-10 text-red-500 relative z-10" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">Baú Vazio!</h2>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Que pena, <strong className="text-white">{personName}</strong>! Outros aventureiros foram mais rápidos e a névoa engoliu os cupons.
                </p>
                <div className="bg-black/60 rounded-xl p-5 border border-white/5 flex flex-col items-center justify-center gap-2">
                  <CloudFog className="w-6 h-6 text-gray-500" />
                  <span className="text-gray-600 font-black tracking-widest uppercase text-xs">
                    Sumiram na neblina
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
                A névoa está muito densa. Não conseguimos validar o baú agora.
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
      <div className="absolute bottom-6 text-center w-full z-10 pointer-events-none">
        <p className="text-gray-700 text-[10px] font-bold uppercase tracking-widest">Mais Trilha Menos Estresse</p>
      </div>
    </div>
  );
}
