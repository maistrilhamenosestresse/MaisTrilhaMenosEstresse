"use client";

import { ChevronLeft, MapPin, Calendar, Users, Info, ShieldAlert, CheckCircle2, Navigation, Sparkles, Loader2, DollarSign, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImmersiveMapModal from "@/components/app/ImmersiveMapModal";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const DynamicMap = dynamic(() => import('@/components/GpsMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center text-gray-400 text-xs">Carregando mapa GPS...</div>
});

import ElevationProfile from "@/components/app/ElevationProfile";

const DEFAULT_CHECKLIST = [
  "Mochila confortável (mínimo 20L)",
  "Bota de trilha ou tênis com boa aderência",
  "2 Litros de Água (Mínimo)",
  "Lanches leves (sanduíches, castanhas, frutas)",
  "Protetor solar e repelente",
  "Documento de Identidade original"
];

export default function TrailDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"mapa" | "info">("info");
  const [elevationData, setElevationData] = useState<{ distance: number; elevation: number }[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [agenda, setAgenda] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [jaTemReserva, setJaTemReserva] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Buscar dados da agenda
        const { data: agendaData } = await supabase
          .from('agendas')
          .select('*')
          .eq('id', unwrappedParams.id)
          .single();

        if (agendaData) setAgenda(agendaData);

        // 2. Buscar dados do cliente logado
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: client } = await supabase
            .from('clients')
            .select('id, full_name, email, cpf, phone')
            .eq('email', user.email)
            .single();
          
          if (client) {
            setClientData(client);

            // 3. Verificar se já tem reserva paga para esta agenda
            const { data: reservaExistente } = await supabase
              .from('reservas')
              .select('id, status_pagamento')
              .eq('client_id', client.id)
              .eq('agenda_id', unwrappedParams.id)
              .in('status_pagamento', ['pago', 'pendente'])
              .limit(1)
              .single();

            if (reservaExistente) {
              setJaTemReserva(true);
            } else {
              router.replace(`/agenda/${unwrappedParams.id}`);
            }
          } else {
            router.replace(`/agenda/${unwrappedParams.id}`);
          }
        } else {
          router.replace(`/agenda/${unwrappedParams.id}`);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da trilha:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [unwrappedParams.id]);

  const handleComprarVaga = async () => {
    if (!clientData) {
      router.push('/app/login');
      return;
    }
    if (!agenda) return;

    setPurchasing(true);
    try {
      // 1. Criar reserva pendente
      const res = await fetch('/api/create-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientData.id,
          agenda_id: unwrappedParams.id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.reservas?.[0]) throw new Error(data.error || "Falha ao criar reserva");

      const reservaId = data.reservas[0].id;
      // 2. Ir para tela de checkout de trilha
      router.push(`/app/trilhas/${unwrappedParams.id}/checkout?reservaId=${reservaId}&agendaId=${unwrappedParams.id}`);
    } catch (err: any) {
      alert("Erro ao iniciar compra: " + err.message);
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }); }
    catch { return dateStr; }
  };

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const trailName = agenda?.title || "Trilha";
  const checklist = agenda?.checklist_items || DEFAULT_CHECKLIST;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-[100dvh]">
      {/* Header Fixo */}
      <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-black text-gray-800 leading-tight line-clamp-1">{trailName}</h1>
          <p className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3" /> {agenda?.date ? formatDate(agenda.date) : "Data a confirmar"}
          </p>
        </div>
        {agenda?.price && (
          <span className="font-black text-purple-600 text-sm">{formatCurrency(agenda.price)}</span>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="bg-white px-4 pt-2 shadow-sm relative z-40">
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-4 relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out ${activeTab === 'info' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
          <button 
            className={`flex-1 py-2 text-sm font-bold z-10 transition-colors flex items-center justify-center gap-2 ${activeTab === 'mapa' ? 'text-blue-700' : 'text-gray-500'}`}
            onClick={() => setActiveTab('mapa')}
          >
            <Navigation className="w-4 h-4" /> Mapa GPS
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-bold z-10 transition-colors flex items-center justify-center gap-2 ${activeTab === 'info' ? 'text-green-700' : 'text-gray-500'}`}
            onClick={() => setActiveTab('info')}
          >
            <Info className="w-4 h-4" /> Informações
          </button>
        </div>
      </div>

      {/* Área Dinâmica — com pb-28 para não esconder o botão fixo abaixo */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden bg-gray-50">
        <AnimatePresence mode="wait">
          
          {/* ABA MAPA GPS */}
          {activeTab === 'mapa' && (
            <motion.div 
              key="mapa"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex flex-col p-4 overflow-y-auto pb-28"
            >
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex gap-3 items-start shrink-0">
                <Navigation className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium">
                  Este mapa é interativo e funciona como um guia GPS para te ajudar na navegação.
                </p>
              </div>

              <div className="flex-none h-[400px] w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group">
                <button 
                  onClick={() => setIsMapExpanded(true)}
                  className="absolute top-4 right-4 z-[10] bg-gray-900/80 backdrop-blur text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-gray-700 opacity-90 hover:opacity-100 transition-opacity flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Expandir Mapa Completo
                </button>
                <DynamicMap agendaId={unwrappedParams.id} onElevationData={setElevationData} />
              </div>

              {elevationData.length > 0 && (
                <ElevationProfile data={elevationData} />
              )}
            </motion.div>
          )}

          {/* ABA INFORMAÇÕES */}
          {activeTab === 'info' && (
            <motion.div 
              key="info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 p-4 space-y-6 overflow-y-auto pb-28"
            >
              {/* Ponto de Encontro */}
              {agenda?.meeting_point && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Ponto de Encontro</h3>
                      <p className="text-xs text-gray-500">Local de saída</p>
                    </div>
                  </div>
                  <p className="font-medium text-gray-700 text-sm mb-4">{agenda.meeting_point}</p>
                  <button 
                    onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(agenda.meeting_point)}`, '_blank')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" /> Abrir no Waze / Maps
                  </button>
                </div>
              )}

              {/* Guia e Detalhes */}
              <div className="grid grid-cols-2 gap-4">
                {agenda?.guide_name && (
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <Users className="w-6 h-6 text-blue-500 mb-2" />
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Líder / Guia</p>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{agenda.guide_name}</p>
                  </div>
                )}
                {agenda?.difficulty && (
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <ShieldAlert className="w-6 h-6 text-orange-500 mb-2" />
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Dificuldade</p>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{agenda.difficulty}</p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              {agenda?.description && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">{agenda.description}</p>
                </div>
              )}

              {/* Checklist */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-800 text-lg mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" /> Checklist Obrigatório
                </h3>
                <ul className="space-y-3">
                  {checklist.map((item: string, index: number) => (
                    <li key={index} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200 flex shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-gray-600 leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botão do Álbum de IA */}
              {jaTemReserva && (
                <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-6 shadow-lg border border-purple-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-30"></div>
                  <h3 className="font-black text-white text-xl mb-2 relative z-10 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-300" />
                    Álbum Inteligente
                  </h3>
                  <p className="text-purple-200 text-sm mb-5 relative z-10 font-medium">
                    Nossa Inteligência Artificial escaneia todas as fotos da trilha e encontra exatamente as que você aparece.
                  </p>
                  <button 
                    onClick={() => router.push(`/app/album/${unwrappedParams.id}`)}
                    className="w-full bg-white hover:bg-gray-50 text-purple-900 font-bold py-3 rounded-xl text-sm transition-colors relative z-10 shadow-sm"
                  >
                    Abrir Álbum da Trilha
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* BOTÃO DE COMPRA FIXO NO RODAPÉ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 p-4 pb-6 shadow-2xl">
        {jaTemReserva ? (
          <div className="w-full bg-green-50 border border-green-200 text-green-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Você já tem uma vaga reservada!
          </div>
        ) : (
          <button
            onClick={handleComprarVaga}
            disabled={purchasing || !agenda}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-base"
          >
            {purchasing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparando checkout...</>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Comprar Vaga {agenda?.price ? `— ${formatCurrency(agenda.price)}` : ''}
              </>
            )}
          </button>
        )}
      </div>

      {/* MODAL DO MAPA IMERSIVO EM TELA CHEIA */}
      <AnimatePresence>
        {isMapExpanded && (
          <ImmersiveMapModal 
            agendaId={unwrappedParams.id} 
            trailName={trailName} 
            onClose={() => setIsMapExpanded(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
