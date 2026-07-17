"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, DollarSign, ChevronRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLowestGrossPrice } from "@/lib/fees";

export default function AgendaList() {
  const [agendas, setAgendas] = useState<any[]>([]);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgendas() {
      const today = new Date().toISOString().split('T')[0];

      // Busca e Atualiza Contador Global de Acessos
      try {
        if (typeof window !== 'undefined') {
          const hasViewedGlobal = localStorage.getItem('viewed_global');
          if (!hasViewedGlobal) {
            // Busca o total atual
            const { data: stats } = await supabase.from('global_stats').select('total_views').eq('id', 1).single();
            if (stats) {
              await supabase.from('global_stats').update({ total_views: (stats.total_views || 0) + 1 }).eq('id', 1);
              localStorage.setItem('viewed_global', 'true');
            }
          }
        }
      } catch (e) {
        console.error("Erro ao registrar acesso global", e);
      }

      // const { data: resSettings } = await supabase.from('settings').select('*').single();
      // if (resSettings && resSettings.maintenance_mode) {
      //   setIsMaintenance(true);
      //   setIsLoading(false);
      //   return;
      // }
      
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar agendas:', error);
        setLoadError('Não foi possível carregar as trilhas. Tente novamente.');
        setIsLoading(false);
        return;
      }

      const availabilityResponse = await fetch('/api/agendas/availability', { cache: 'no-store' });
      const availability = availabilityResponse.ok
        ? await availabilityResponse.json()
        : { reservedByAgenda: {} };

      if (data) {
        setAgendas(data.map((agenda) => ({
          ...agenda,
          reserved_count: availability.reservedByAgenda?.[agenda.id] || 0,
        })));
      }
      setIsLoading(false);
    }
    fetchAgendas();
  }, []);

  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-[#0F1722] text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[150px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />
        <h1 className="text-4xl md:text-6xl font-black text-[#F17B37] mb-6">Em Manutenção 🚧</h1>
        <p className="text-gray-300 max-w-lg mb-8 text-lg md:text-xl">
          Nossa equipe está atualizando a agenda com novas aventuras incríveis! 
          Por favor, volte em alguns instantes.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
            <Link href="/" className="bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-4 rounded-2xl font-bold transition">
              Voltar ao Início
            </Link>
            <a href="/carrinho" className="bg-[#F17B37] hover:bg-orange-600 px-8 py-4 rounded-2xl font-bold transition shadow-[0_0_20px_rgba(241,123,55,0.4)]">
              Ver meu Carrinho
            </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans selection:bg-[#F17B37] selection:text-white pb-20 overflow-hidden relative">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <header className="pt-16 pb-12 px-6 max-w-7xl mx-auto relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6 backdrop-blur-md"
        >
          <span className="text-[#F17B37] text-sm font-bold tracking-widest uppercase">Mais Trilha Menos Estresse</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 leading-tight"
        >
          Calendário <br className="md:hidden" />de <span className="text-[#F17B37]">Aventuras</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 text-lg max-w-2xl mx-auto"
        >
          Escolha o seu próximo destino, convide a galera e recarregue as energias.
        </motion.p>
      </header>

      <div className="px-6 max-w-7xl mx-auto relative z-10">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-white/5 border border-white/10 rounded-3xl w-full animate-pulse"></div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-20 bg-red-500/10 rounded-3xl border border-red-400/20 max-w-2xl mx-auto">
            <p className="text-red-200 font-bold">{loadError}</p>
          </div>
        ) : agendas.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md max-w-2xl mx-auto"
          >
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">Nenhuma trilha encontrada neste momento.</p>
            <p className="text-sm text-gray-500 mt-2">Novas aventuras serão adicionadas em breve.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
            {agendas.map((agenda, index) => {
              // Corrigir fuso horário para não diminuir 1 dia (-03:00)
              const eventDate = new Date(agenda.date + 'T12:00:00Z');
              const day = eventDate.toLocaleDateString('pt-BR', { day: '2-digit' });
              const month = eventDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
              
              const occupied = Number(agenda.reserved_count || 0);
              const maxCap = agenda.max_capacity || 15;
              const remaining = Math.max(0, maxCap - occupied);
              const isFull = remaining === 0;
              
              return (
                <div key={agenda.id} className="block group">
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white/5 border border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden transition-all duration-300 relative h-full flex flex-col ${isFull ? 'opacity-70 grayscale' : 'hover:bg-white/10 md:hover:-translate-y-2 md:hover:shadow-2xl hover:shadow-[#F17B37]/10'}`}
                  >
                    
                    {/* Imagem de Capa do Card */}
                    <div className="h-32 md:h-48 relative overflow-hidden shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a2332] to-transparent z-10" />
                      {agenda.images && agenda.images.length > 0 ? (
                        <img src={agenda.images[0]} className={`w-full h-full object-cover transition duration-700 ${!isFull && 'group-hover:scale-110'}`} alt="Capa" />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center"><ImageIcon className="text-gray-600 h-8 w-8 md:h-10 md:w-10" /></div>
                      )}
                      
                      {/* Badge da Data */}
                      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl p-1.5 md:p-2 px-2 md:px-4 text-center shadow-xl">
                        <p className={`${isFull ? 'text-gray-400' : 'text-[#F17B37]'} font-bold tracking-widest text-[8px] md:text-[10px] uppercase mb-0.5`}>{month}</p>
                        <p className="text-lg md:text-2xl font-black leading-none">{day}</p>
                      </div>
                      
                      {isFull && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40 backdrop-blur-sm">
                          <span className="bg-red-500 text-white font-black px-4 py-2 rounded-xl tracking-widest uppercase transform -rotate-12 border-2 border-white/20 shadow-2xl text-sm md:text-base">
                            ESGOTADO
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="p-3 md:p-6 flex-1 flex flex-col relative z-20 bg-[#1a2332]">
                      <h3 className={`text-sm md:text-xl font-bold mb-2 md:mb-4 transition line-clamp-2 ${isFull ? 'text-gray-300' : 'group-hover:text-[#F17B37]'}`}>{agenda.title}</h3>
                      
                      <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 mt-auto">
                        <div className="flex items-start gap-1.5 md:gap-3 text-xs md:text-sm text-gray-400">
                          <MapPin className={`h-3 w-3 md:h-4 md:w-4 shrink-0 mt-0.5 ${isFull ? 'text-gray-500' : 'text-[#F17B37]'}`} />
                          <span className="line-clamp-1 md:line-clamp-2">{agenda.meeting_point}</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-3 text-xs md:text-sm text-gray-400">
                          <DollarSign className={`h-3 w-3 md:h-4 md:w-4 ${isFull ? 'text-gray-500' : 'text-[#25D366]'}`} />
                          <span className="font-semibold text-white text-xs text-gray-400">a partir de</span> <span className="font-black text-white">R$ {getLowestGrossPrice(agenda.price, agenda.taxa_gratis).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className={`mb-4 md:mb-6 mt-2 text-xs md:text-sm font-medium ${isFull ? 'text-red-400' : 'text-[#F17B37]'}`}>
                        {maxCap} vagas totais &bull; {remaining > 0 ? `${remaining} vagas restantes` : 'Esgotado'}
                      </div>

                      {isFull ? (
                        <button disabled className="inline-flex w-full justify-center items-center text-gray-400 text-[10px] md:text-sm font-bold uppercase tracking-wide bg-gray-800 px-2 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl cursor-not-allowed">
                          Sem Vagas
                        </button>
                      ) : (
                        <Link href={`/agenda/${agenda.id}`} className="inline-flex w-full justify-center items-center text-[#F17B37] text-[10px] md:text-sm font-bold uppercase tracking-wide bg-[#F17B37]/10 px-2 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl hover:bg-[#F17B37] hover:text-white transition">
                          Acessar <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
