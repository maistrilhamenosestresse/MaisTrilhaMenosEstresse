"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, MapPin, Award, ArrowRight, User, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hasMemberAccess, REQUIRED_PAID_TRAILS } from "@/lib/member-access";

export default function MembrosPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<'granted' | 'denied' | 'checking'>('checking');
  const [clientData, setClientData] = useState<any>(null);
  const [trailCount, setTrailCount] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent || navigator.vendor || (window as any).opera : '';
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      setIsLoading(true);
      try {
        // Verificar sessão (login)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setAccessStatus('denied');
          setIsLoading(false);
          return;
        }

        // Buscar dados do cliente pelo email
        const { data: client } = await supabase
          .from('clients')
          .select('id, full_name, email, pontos, cashback_saldo, membro_vip, photo_url')
          .eq('email', user.email)
          .single();

        if (!client) {
          setAccessStatus('denied');
          setIsLoading(false);
          return;
        }

        setClientData(client);

        // Contar trilhas concluídas (reservas com status pago)
        const { count } = await supabase
          .from('reservas')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status_pagamento', 'pago');

        const trails = count || 0;
        setTrailCount(trails);

        // Acesso automático após 3 trilhas pagas ou por autorização manual.
        const hasAccess = hasMemberAccess(trails, client.membro_vip === true);
        setAccessStatus(hasAccess ? 'granted' : 'denied');

      } catch (e) {
        console.error('Erro ao verificar acesso:', e);
        setAccessStatus('denied');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, []);

  // --- Loading State ---
  if (isLoading || isMobile === null) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F17B37]"></div>
      </div>
    );
  }

  // --- Desktop redirect ---
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl max-w-md backdrop-blur-md shadow-2xl">
          <div className="bg-[#F17B37]/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="h-10 w-10 text-[#F17B37]" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Área Exclusiva</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            A Área de Membros da Mais Trilha foi desenvolvida exclusivamente para o seu celular, garantindo a melhor experiência com seus bônus, álbuns de fotos e cashback.
          </p>
          <div className="bg-[#F17B37] text-white p-4 rounded-xl font-bold animate-pulse shadow-[0_0_20px_rgba(241,123,55,0.4)]">
            Logue no celular para ter acesso à área de membros
          </div>
          <button onClick={() => router.push('/')} className="mt-6 text-gray-500 hover:text-white transition font-semibold">
            Voltar ao site
          </button>
        </div>
      </div>
    );
  }

  // --- Acesso NEGADO ---
  if (accessStatus === 'denied') {
    return (
      <div className="min-h-[100dvh] bg-[#0F1722] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl max-w-sm backdrop-blur-md shadow-2xl w-full">
          <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Acesso Restrito</h1>
          <p className="text-gray-400 mb-2 leading-relaxed text-sm">
            A Área de Membros é exclusiva para aventureiros frequentes.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${trailCount >= REQUIRED_PAID_TRAILS ? 'bg-green-500/30' : 'bg-white/10'}`}>
                <MapPin className={`h-4 w-4 ${trailCount >= REQUIRED_PAID_TRAILS ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{REQUIRED_PAID_TRAILS} Trilhas Pagas</p>
                <p className="text-gray-500 text-xs">{trailCount} de {REQUIRED_PAID_TRAILS} trilhas pagas</p>
                <div className="h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#F17B37] rounded-full transition-all" style={{ width: `${Math.min((trailCount / REQUIRED_PAID_TRAILS) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Autorização Manual</p>
                <p className="text-gray-500 text-xs">Peça ao administrador para liberar seu acesso</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/app')}
            className="w-full bg-[#F17B37] text-white py-3 rounded-xl font-black hover:bg-orange-500 transition"
          >
            Voltar ao App
          </button>
        </div>
      </div>
    );
  }

  // --- MOBILE VIEW com acesso GRANTED ---
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col pb-24">
      {/* App Header */}
      <header className="bg-[#0F1722] text-white px-6 pt-12 pb-8 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F17B37] rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-x-1/2 translate-y-1/3"></div>
        
        <div className="relative z-10 flex justify-between items-center mb-6">
          <button onClick={() => router.push('/app')} className="text-white/70 hover:text-white text-sm font-bold flex items-center gap-1">
            <ArrowRight className="h-4 w-4 rotate-180" /> Sair
          </button>
          <div className="bg-amber-500/20 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <Award className="h-3 w-3" /> Membro VIP
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-1">Olá, {clientData?.full_name?.split(' ')[0] || 'Aventureiro'}!</h1>
          <p className="text-gray-400 text-sm">Seu painel exclusivo de benefícios.</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 -mt-6 relative z-20 space-y-5">
        
        {/* Gamification Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="bg-orange-50 text-[#F17B37] p-3 rounded-full mb-3">
              <Coins className="h-6 w-6" />
            </div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Saldo Cashback</p>
            <p className="text-xl font-black text-gray-800">
              R$ {Number(clientData?.cashback_saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="bg-amber-50 text-amber-500 p-3 rounded-full mb-3">
              <Award className="h-6 w-6" />
            </div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Meus Pontos</p>
            <p className="text-xl font-black text-gray-800">{clientData?.pontos || 0}</p>
            <p className="text-xs text-gray-400">≈ R$ {((clientData?.pontos || 0) / 100).toFixed(2)} desconto</p>
          </div>
        </div>

        {/* Trail Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-gray-800 text-sm">Trilhas Realizadas</p>
            <span className="text-xs font-bold text-[#F17B37] bg-orange-50 px-2 py-1 rounded-full">{trailCount} trilha{trailCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#F17B37] to-amber-400 rounded-full" style={{ width: `${Math.min((trailCount / 3) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-2">
          <div className="p-5 border-b border-gray-50">
            <h2 className="font-black text-gray-800 text-lg mb-1">Serviços Exclusivos</h2>
            <p className="text-xs text-gray-500">Use seus pontos e acesse suas memórias.</p>
          </div>
          
          <div className="divide-y divide-gray-50">
            <button className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-[#F17B37] to-orange-400 p-3 rounded-xl text-white shadow-md">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Álbum de Trilhas (IA)</h3>
                  <p className="text-xs text-gray-500">Encontre suas fotos por reconhecimento facial</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </button>

            <button onClick={() => router.push('/app/loja')} className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 p-3 rounded-xl text-white shadow-md">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Loja de Aluguel VIP</h3>
                  <p className="text-xs text-gray-500">Use seus pontos e cashback na loja</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
