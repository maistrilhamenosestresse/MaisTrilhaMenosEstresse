"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Mail, Map, Calendar, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";
import { useCartStore } from "@/store/cartStore";
import type { Agenda } from "@/types";

function SucessoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCartStore();
  const agendaId = searchParams.get('agenda_id');
  const [agenda, setAgenda] = useState<Agenda | null>(null);

  useEffect(() => {
    // Limpar o carrinho ao entrar na página de sucesso
    clearCart();

    if (agendaId) {
      supabase.from('agendas').select('*').eq('id', agendaId).single().then(({data}) => {
        if (data) setAgenda(data);
      });
    }
  }, [agendaId, clearCart]);

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans flex flex-col items-center justify-center relative overflow-hidden p-6">
      {/* Background Decorativo Animado */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[150px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#25D366] rounded-full blur-[150px] pointer-events-none" 
      />

      <div className="w-full max-w-lg z-10">
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
          className="bg-[#1a2332]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-10 text-center shadow-2xl relative overflow-hidden"
        >
          {/* Confetti / Luz no topo do card */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#25D366] to-transparent opacity-50" />

          {/* Ícone Animado de Sucesso */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
            className="w-24 h-24 bg-gradient-to-tr from-[#25D366] to-[#4ade80] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(37,211,102,0.4)]"
          >
            <CheckCircle2 className="h-12 w-12 text-[#0F1722]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Vaga Garantida!</h1>
            <p className="text-gray-300 text-lg mb-8">
              Parabéns! Sua compra foi confirmada e sua vaga para essa aventura está reservada.
            </p>

            <div className="bg-white/5 rounded-2xl p-5 mb-8 text-left border border-white/10 shadow-inner">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-[#F17B37]/20 p-3 rounded-xl shrink-0">
                  <Mail className="h-6 w-6 text-[#F17B37]" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">E-mail Enviado!</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Enviamos um e-mail com <strong>todas as instruções</strong> da trilha: o que vestir, o que levar para comer, níveis de dificuldade e muito mais. Verifique sua caixa de entrada (e o SPAM)!
                  </p>
                </div>
              </div>

              {agenda && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Map className="h-4 w-4 text-[#F17B37]" /> {agenda.title}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="h-4 w-4 text-[#F17B37]" /> {new Date(agenda.date + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => router.push('/agenda')}
              className="w-full bg-gradient-to-r from-[#F17B37] to-[#f9a03f] text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] shadow-[0_10px_20px_rgba(241,123,55,0.2)] transition-all"
            >
              Voltar para as Trilhas <ChevronRight className="h-5 w-5" />
            </button>
          </motion.div>

        </motion.div>

        {/* Logo Bottom */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center flex flex-col items-center gap-2"
        >
          <ShieldCheck className="h-8 w-8 text-[#F17B37] opacity-50" />
          <p className="text-xs font-bold tracking-widest text-gray-500 uppercase">Mais Trilha Menos Estresse</p>
        </motion.div>
      </div>
    </div>
  );
}

export default function SucessoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1722] flex items-center justify-center text-[#F17B37]">Carregando...</div>}>
      <SucessoContent />
    </Suspense>
  );
}
