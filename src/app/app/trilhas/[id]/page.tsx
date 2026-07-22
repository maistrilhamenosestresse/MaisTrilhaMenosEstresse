"use client";

import { ChevronLeft, MapPin, Calendar, Users, Info, ShieldAlert, CheckCircle2, Navigation, Sparkles, Loader2, WifiOff, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImmersiveMapModal from "@/components/app/ImmersiveMapModal";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchCurrentClient } from "@/lib/app/current-client";
import { formatOfflineUpdate, getOfflineData, saveOfflineData } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";

const DynamicMap = dynamic(() => import('@/components/app/ImmersiveMap'), {
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
  const online = useNetworkStatus();

  const [activeTab, setActiveTab] = useState<"mapa" | "info">("info");
  const [elevationData, setElevationData] = useState<{ distance: number; elevation: number }[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [openOfflineSetup, setOpenOfflineSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<any>(null);
  const [jaTemReserva, setJaTemReserva] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [usingOfflineCopy, setUsingOfflineCopy] = useState(false);
  const [routeOfflineReady, setRouteOfflineReady] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      let hadCachedData = false;
      setLoading(true);
      setLoadError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/app/login');
          return;
        }

        const cacheKey = `trail:${unwrappedParams.id}`;
        const cached = getOfflineData<{ agenda: any; hasPaidReservation: boolean }>(session.user.id, cacheKey);
        if (cached?.data.hasPaidReservation) {
          hadCachedData = true;
          setAgenda(cached.data.agenda);
          setJaTemReserva(true);
          setOfflineSavedAt(cached.savedAt);
        }
        if (!navigator.onLine) {
          setUsingOfflineCopy(Boolean(cached?.data.hasPaidReservation));
          if (!cached?.data.hasPaidReservation) setLoadError("Esta trilha ainda não foi preparada para uso offline neste aparelho.");
          return;
        }

        // 1. Buscar dados da agenda
        const { data: agendaData, error: agendaError } = await supabase
          .from('agendas')
          .select('*')
          .eq('id', unwrappedParams.id)
          .single();

        if (agendaError) throw agendaError;
        if (agendaData) setAgenda(agendaData);

        // 2. Buscar dados do cliente logado
        const user = session.user;
        if (user) {
          const client = await fetchCurrentClient<{ id: string }>();
          
          if (client) {
            // 3. O mapa e os dados operacionais são exclusivos de reservas pagas.
            const { data: reservaExistente } = await supabase
              .from('reservas')
              .select('id, status_pagamento')
              .eq('client_id', client.id)
              .eq('agenda_id', unwrappedParams.id)
              .eq('status_pagamento', 'pago')
              .limit(1)
              .maybeSingle();

            if (reservaExistente?.status_pagamento === 'pago') {
              setJaTemReserva(true);
              saveOfflineData(session.user.id, cacheKey, { agenda: agendaData, hasPaidReservation: true });
              setOfflineSavedAt(new Date().toISOString());
              setUsingOfflineCopy(false);
            } else {
              router.replace(`/app/trilhas/${unwrappedParams.id}/carrinho`);
            }
          } else {
            router.replace('/app/login');
          }
        } else {
          router.replace('/app/login');
        }
      } catch (err) {
        console.error("Erro ao carregar dados da trilha:", err);
        if (!hadCachedData) setLoadError("Não foi possível carregar os dados desta trilha.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [unwrappedParams.id, online, router]);

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }); }
    catch { return dateStr; }
  };

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  if (!jaTemReserva) {
    if (loadError) {
      return (
        <div className="mt-app-page flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <WifiOff className="h-10 w-10 text-amber-600" />
          <p className="font-black text-[#071829]">Trilha indisponível offline</p>
          <p className="text-sm text-slate-500">{loadError}</p>
          <button onClick={() => router.push('/app/trilhas')} className="mt-2 rounded-2xl bg-[#0B2540] px-5 py-3 text-sm font-black text-white">Voltar para minhas trilhas</button>
        </div>
      );
    }
    return (
      <div className="mt-app-page flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
        <p className="text-sm font-semibold text-slate-500">Abrindo a página de compra...</p>
      </div>
    );
  }

  const trailName = agenda?.title || "Trilha";
  const checklist = agenda?.checklist_items || DEFAULT_CHECKLIST;

  return (
    <div className="mt-app-page flex h-full min-h-0 flex-col">
      {/* Header Fixo */}
      <div className="mt-app-header sticky top-0 z-50 flex items-center gap-4 border-b px-4 py-3">
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
          <span className="text-sm font-black text-[#D96224]">{formatCurrency(agenda.price)}</span>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="relative z-40 border-b border-gray-100 bg-white/95 px-4 pt-2 backdrop-blur-xl">
        {usingOfflineCopy && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900">
            <WifiOff className="h-4 w-4" /> Modo offline · salvo em {offlineSavedAt ? formatOfflineUpdate(offlineSavedAt) : "este aparelho"}
          </div>
        )}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-4 relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out ${activeTab === 'info' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
          <button 
            className={`flex-1 py-2 text-sm font-bold z-10 transition-colors flex items-center justify-center gap-2 ${activeTab === 'mapa' ? 'text-blue-700' : 'text-gray-500'}`}
            onClick={() => setActiveTab('mapa')}
          >
            <Navigation className="w-4 h-4" /> Mapa GPS
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-bold z-10 transition-colors flex items-center justify-center gap-2 ${activeTab === 'info' ? 'text-[#0B2540]' : 'text-gray-500'}`}
            onClick={() => setActiveTab('info')}
          >
            <Info className="w-4 h-4" /> Informações
          </button>
        </div>
      </div>

      {/* Área Dinâmica — com pb-28 para não esconder o botão fixo abaixo */}
      <div className="relative flex-1 overflow-x-hidden overflow-y-auto bg-transparent">
        <AnimatePresence mode="wait">
          
          {/* ABA MAPA GPS */}
          {activeTab === 'mapa' && (
            <motion.div 
              key="mapa"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex flex-col overflow-y-auto p-4 pb-6"
            >
              <div className="mb-4 flex shrink-0 items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3.5">
                <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <p className="text-xs font-black text-blue-950">Mapa interativo com navegação GPS</p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-blue-800/75">Toque no mapa, confira altitude e expanda para iniciar o acompanhamento do percurso.</p>
                  <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${routeOfflineReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {routeOfflineReady ? <CheckCircle2 className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                    {routeOfflineReady ? "ROTA PRONTA PARA USO OFFLINE" : "PREPARANDO ROTA OFFLINE"}
                  </span>
                </div>
              </div>

              <div className="flex-none h-[400px] w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group">
                <button
                  onClick={() => { setOpenOfflineSetup(true); setIsMapExpanded(true); }}
                  className="absolute left-4 top-4 z-[10] flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-[#071829]/90 px-3 py-2 text-[10px] font-black text-white shadow-xl backdrop-blur"
                >
                  <Download className="h-4 w-4 text-cyan-200" /> Baixar offline
                </button>
                <button 
                  onClick={() => setIsMapExpanded(true)}
                  className="absolute top-4 right-4 z-[10] bg-gray-900/80 backdrop-blur text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-gray-700 opacity-90 hover:opacity-100 transition-opacity flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Tela cheia
                </button>
                <DynamicMap agendaId={unwrappedParams.id} onElevationData={setElevationData} onOfflineAvailabilityChange={(available) => setRouteOfflineReady(available)} />
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
              className="absolute inset-0 space-y-6 overflow-y-auto p-4 pb-6"
            >
              {/* Ponto de Encontro */}
              {agenda?.meeting_point && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
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
                    <Navigation className="w-4 h-4" /> Abrir no Waze ou Google Maps
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
                  <CheckCircle2 className="w-5 h-5 text-blue-700" /> Lista obrigatória
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
                <div className="relative overflow-hidden rounded-3xl border border-blue-950 bg-[linear-gradient(145deg,#061526,#0B2540)] p-6 shadow-lg">
                  <div className="absolute -mr-8 -mt-8 right-0 top-0 h-32 w-32 rounded-full bg-[#F17B37] opacity-25 blur-3xl"></div>
                  <h3 className="font-black text-white text-xl mb-2 relative z-10 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-200" />
                    Álbum Inteligente
                  </h3>
                  <p className="relative z-10 mb-5 text-sm font-medium text-blue-100/75">
                    Nossa Inteligência Artificial escaneia todas as fotos da trilha e encontra exatamente as que você aparece.
                  </p>
                  <button 
                    onClick={() => router.push(`/app/album/${unwrappedParams.id}`)}
                    className="relative z-10 w-full rounded-xl bg-white py-3 text-sm font-bold text-[#0B2540] shadow-sm transition-colors hover:bg-gray-50"
                  >
                    Abrir Álbum da Trilha
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* MODAL DO MAPA IMERSIVO EM TELA CHEIA */}
      <AnimatePresence>
        {isMapExpanded && (
          <ImmersiveMapModal 
            agendaId={unwrappedParams.id} 
            trailName={trailName} 
            initialDrawerOpen={openOfflineSetup}
            onClose={() => { setIsMapExpanded(false); setOpenOfflineSetup(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
