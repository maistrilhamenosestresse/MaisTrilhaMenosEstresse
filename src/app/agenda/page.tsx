"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, DollarSign, ChevronRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function AgendaList() {
  const [agendas, setAgendas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgendas() {
      const today = new Date().toISOString().split('T')[0];

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

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans selection:bg-[#F17B37] selection:text-white pb-20 overflow-hidden relative">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-7xl px-4 pb-9 pt-12 text-center sm:px-6 md:pb-12 md:pt-16">
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
          className="mx-auto max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg"
        >
          Escolha o seu próximo destino, convide a galera e recarregue as energias.
        </motion.p>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
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
                    <div className="relative h-48 shrink-0 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a2332] to-transparent z-10" />
                      {agenda.images && agenda.images.length > 0 ? (
                        <Image
                          src={agenda.images[0]}
                          alt={`Trilha ${agenda.title}`}
                          fill
                          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                          className={`object-cover transition duration-700 ${!isFull ? "group-hover:scale-105" : ""}`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center"><ImageIcon className="text-gray-600 h-8 w-8 md:h-10 md:w-10" /></div>
                      )}
                      
                      {/* Badge da Data */}
                      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl p-1.5 md:p-2 px-2 md:px-4 text-center shadow-xl">
                        <p className={`${isFull ? 'text-gray-400' : 'text-[#F17B37]'} mb-0.5 text-xs font-bold uppercase tracking-widest`}>{month}</p>
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
                    <div className="relative z-20 flex flex-1 flex-col bg-[#1a2332] p-5 md:p-6">
                      <h3 className={`mb-4 line-clamp-2 text-lg font-bold leading-snug transition md:text-xl ${isFull ? 'text-gray-300' : 'group-hover:text-[#F17B37]'}`}>{agenda.title}</h3>
                      
                      <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 mt-auto">
                        <div className="flex items-start gap-3 text-sm text-gray-300">
                          <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isFull ? 'text-gray-500' : 'text-[#F17B37]'}`} />
                          <span className="line-clamp-1 md:line-clamp-2">{agenda.meeting_point}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-300">
                          <DollarSign className={`h-4 w-4 ${isFull ? 'text-gray-500' : 'text-[#25D366]'}`} />
                          <span className="font-black text-white">R$ {Number(agenda.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className={`mb-4 md:mb-6 mt-2 text-xs md:text-sm font-medium ${isFull ? 'text-red-400' : 'text-[#F17B37]'}`}>
                        {maxCap} vagas totais &bull; {remaining > 0 ? `${remaining} vagas restantes` : 'Esgotado'}
                      </div>

                      {isFull ? (
                        <button disabled className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold uppercase tracking-wide text-gray-400">
                          Sem Vagas
                        </button>
                      ) : (
                        <Link href={`/agenda/${agenda.id}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F17B37]/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#F17B37] transition hover:bg-[#F17B37] hover:text-white">
                          Ver detalhes <ChevronRight className="ml-1 h-4 w-4" />
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
