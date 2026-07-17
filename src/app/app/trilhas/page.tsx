"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Calendar, Clock, ChevronRight, Navigation, Backpack, CloudLightning, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PwaTrilhas() {
  const [activeTab, setActiveTab] = useState<"euVou" | "explorar">("euVou");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [euVouTrails, setEuVouTrails] = useState<any[]>([]);
  const [explorarTrails, setExplorarTrails] = useState<any[]>([]);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user?.email) {
          await supabase.auth.signOut({ scope: "local" });
          router.replace("/app/login");
          return;
        }

        // 1. Busca o client_id
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('email', session.user.email)
          .single();
          
        if (client) {
          // 2. Busca Reservas (Eu Vou) - Apenas pagas
          const { data: reservas } = await supabase
            .from('reservas')
            .select(`
              id,
              status_pagamento,
              agendas (
                id,
                title,
                date,
                difficulty,
                duration_hours
              )
            `)
            .eq('client_id', client.id)
            .eq('status_pagamento', 'pago');

          if (reservas) {
            const mappedEuVou = reservas
              .filter(r => r.agendas) // Garante que a agenda existe
              .map(r => ({
                id: (r.agendas as any).id, // Usa o ID da agenda para roteamento
                reservaId: r.id,
                name: (r.agendas as any).title,
                date: (r.agendas as any).date,
                status: "Confirmado",
                weather: "Ver Previsão",
                image: "⛰️"
              }));
            setEuVouTrails(mappedEuVou);
          }
        }

        // 3. Busca Agendas Futuras (Explorar)
        const hoje = new Date().toISOString().slice(0, 10);
        const { data: agendas, error: agendasError } = await supabase
          .from('agendas')
          .select('*')
          .gte('date', hoje)
          .order('date', { ascending: true });

        if (agendasError) throw agendasError;

        if (agendas) {
          const mappedExplorar = agendas.map(a => ({
            id: a.id,
            name: a.title,
            date: a.date,
            duration: a.duration_hours ? `${a.duration_hours}h` : "1 Dia",
            difficulty: a.difficulty || "Média",
            price: a.price || 0,
            image: "🏞️"
          }));
          setExplorarTrails(mappedExplorar);
        }
        
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        setLoadError("Não foi possível carregar suas trilhas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, supabase]);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy, HH:mm", { locale: ptBR });
    } catch (e) {
      return dateStr;
    }
  };

  const filteredExplorar = explorarTrails.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header and Tabs */}
      <div className="bg-white pt-12 pb-4 px-6 rounded-b-[2.5rem] shadow-sm relative z-10 border-b border-gray-100">
        <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-purple-600" /> Suas Aventuras
        </h1>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-4 relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out ${activeTab === 'explorar' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
          <button 
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${activeTab === 'euVou' ? 'text-purple-700' : 'text-gray-500'}`}
            onClick={() => setActiveTab('euVou')}
          >
            Eu Vou
          </button>
          <button 
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${activeTab === 'explorar' ? 'text-purple-700' : 'text-gray-500'}`}
            onClick={() => setActiveTab('explorar')}
          >
            Comprar Mais
          </button>
        </div>

        {activeTab === 'explorar' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative mt-2">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar destino..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500 transition-all outline-none"
            />
          </motion.div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="px-6 py-6 flex-1 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium text-sm">Buscando aventuras...</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-12 bg-red-50 border border-red-100 rounded-3xl px-5">
            <p className="text-sm font-bold text-red-700">{loadError}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* Aba: EU VOU (Minhas Viagens) */}
            {activeTab === 'euVou' && (
              <motion.div 
                key="euVou"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {euVouTrails.length > 0 ? euVouTrails.map((trail) => (
                  <div key={trail.reservaId} className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Backpack className="w-24 h-24" /></div>
                    
                    <div className="flex gap-4 items-start relative z-10 mb-4">
                      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner border border-purple-100">
                        {trail.image}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 mb-1 inline-block">
                          {trail.status}
                        </span>
                        <h3 className="font-black text-gray-800 text-base leading-tight mb-1">{trail.name}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 font-medium"><Calendar className="w-3.5 h-3.5" /> {formatDate(trail.date)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                      <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-2">
                        <CloudLightning className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Previsão</p>
                          <p className="text-xs font-bold text-gray-700">{trail.weather}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Acesso</p>
                          <p className="text-xs font-bold text-gray-700">GPS Liberado</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => router.push(`/app/trilhas/${trail.id}`)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 relative z-10 group-hover:scale-[1.02]"
                    >
                      <Navigation className="w-4 h-4" /> Acessar Álbum / Informações
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🎒</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Nenhuma aventura marcada</h3>
                    <p className="text-sm text-gray-500 px-4">Você ainda não tem trilhas agendadas. Vá para a aba "Comprar Mais" para explorar novos destinos!</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Aba: EXPLORAR (Comprar Mais) */}
            {activeTab === 'explorar' && (
              <motion.div 
                key="explorar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {filteredExplorar.length > 0 ? filteredExplorar.map((trail) => (
                  <div 
                    key={trail.id} 
                    onClick={() => router.push(`/agenda/${trail.id}`)}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex gap-4 items-center group cursor-pointer hover:border-purple-200 transition-colors"
                  >
                    <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                      {trail.image}
                    </div>
                    
                    <div className="flex-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 inline-block
                        ${trail.difficulty === 'Difícil' || trail.difficulty === 'Pesada' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
                      `}>
                        {trail.difficulty}
                      </span>
                      <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1">{trail.name}</h3>
                      <div className="flex flex-col gap-0.5 mb-1">
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(trail.date)}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {trail.duration}</p>
                      </div>
                      <p className="font-black text-purple-600">{formatCurrency(trail.price)}</p>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500 px-4">Nenhuma trilha encontrada para essa busca ou não há agendas futuras no momento.</p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
