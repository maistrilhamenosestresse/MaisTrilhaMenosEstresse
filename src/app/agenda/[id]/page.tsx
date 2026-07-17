"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, DollarSign, CheckCircle2, ChevronLeft, ChevronRight, Video as VideoIcon, Send, FileText, Image as ImageIcon, Info, X, Clock, Navigation, Mountain } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getLowestGrossPrice } from "@/lib/fees";
import { useCartStore } from "@/store/cartStore";

export default function AgendaDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [agenda, setAgenda] = useState<any>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [paidCount, setPaidCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'roteiro' | 'embarque' | 'galeria'>('roteiro');

  useEffect(() => {
    async function fetchAgenda() {
      const { data: resSettings } = await supabase.from('settings').select('*').single();
        if (resSettings && resSettings.maintenance_mode) {
          setIsMaintenance(true);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .eq('id', params.id as string)
        .single();
        
      if (!error && data) {
        setAgenda(data);
        
        const availability = await fetch(`/api/agendas/${data.id}/availability`, { cache: 'no-store' });
        if (availability.ok) {
          const result = await availability.json();
          setPaidCount(result.reserved || 0);
        }

        // Incrementa visualização apenas uma vez por carregamento de página e por dispositivo
        try {
          if (typeof window !== 'undefined') {
            const viewedKey = `viewed_agenda_${data.id}`;
            const hasViewed = localStorage.getItem(viewedKey);
            
            if (!hasViewed) {
              await fetch(`/api/agendas/${data.id}/availability`, { method: 'POST' });
                
              localStorage.setItem(viewedKey, 'true');
            }
          }
        } catch (e) {
          console.error("Erro ao computar visualização", e);
        }
      }
      setIsLoading(false);
    }
    fetchAgenda();
  }, [params.id]);

  if (isLoading) {
    return <div className="min-h-screen bg-[#0F1722] flex items-center justify-center text-[#F17B37]">Carregando trilha...</div>;
  }

  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <h1 className="text-4xl font-black text-[#F17B37]">⚠️ Em Manutenção</h1>
        <p className="text-gray-400 text-lg max-w-md">Nosso sistema está passando por uma atualização rápida. Voltamos em instantes!</p>
      </div>
    );
  }

  if (!agenda) {
    return <div className="min-h-screen bg-[#0F1722] flex items-center justify-center text-white">Trilha não encontrada.</div>;
  }

  const nextImage = () => {
    if (agenda.images && agenda.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % agenda.images.length);
    }
  };

  const prevImage = () => {
    if (agenda.images && agenda.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + agenda.images.length) % agenda.images.length);
    }
  };

  const coverImage = agenda.images && agenda.images.length > 0 
    ? agenda.images[currentImageIndex] 
    : "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/paisagem/IMG_0220.JPG";

  const eventDateObj = new Date(agenda.date + 'T12:00:00Z');
  const eventDate = eventDateObj.toLocaleDateString('pt-BR');
  
  const maxCap = agenda.max_capacity || 15;
  const remaining = Math.max(0, maxCap - paidCount);
  const isSoldOut = remaining === 0;
  const handleComprar = () => {
    useCartStore.getState().addItem({
      agendaId: agenda.id,
      title: agenda.title,
      price: agenda.price,
      date: eventDate,
      quantity: 1,
      dependents: [],
      availableSpots: remaining,
      acceptedPaymentMethods: agenda.accepted_payment_methods || ['PIX', 'CREDIT_CARD', 'BOLETO'],
      taxa_gratis: agenda.taxa_gratis
    });
    router.push('/carrinho');
  };

  const handleShare = async () => {
    const whatsappText = `⛰️ *${agenda.title.toUpperCase()}* ⛰️\n\nQue tal sair da rotina e vir se aventurar com a gente? Confira os detalhes desse evento:\n\n📅 *Data:* ${eventDate}\n💰 *Investimento:* R$ ${agenda.price.toFixed(2).replace('.', ',')}\n\n✨ *Como participar?*\nPara ver o roteiro completo, o ponto de encontro e garantir a sua vaga, é só acessar o link oficial abaixo:\n\n👉 ${window.location.href}`;

    const shareData = {
      title: `Trilha: ${agenda.title} | Mais Trilha Menos Estresse`,
      text: whatsappText,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(whatsappText);
        alert("Texto e link copiados! Agora é só colar no WhatsApp.");
      }
    } catch (err) {
      console.log('Compartilhamento cancelado ou falhou', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans selection:bg-[#F17B37] selection:text-white pb-32">
      
      {/* Header Botões Superiores */}
      <div className="absolute top-6 left-6 right-6 z-30 flex justify-between">
        <button onClick={() => router.push('/agenda')} className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/10 hover:bg-white/10 transition">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Carrossel / Imagem de Capa */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative h-[45vh] w-full group"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1722] via-[#0F1722]/60 to-transparent z-10" />
        
        <AnimatePresence mode="wait">
          <motion.img 
            key={currentImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            src={coverImage}
            alt={agenda.title} 
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        {agenda.images && agenda.images.length > 1 && (
          <div className="absolute inset-0 z-20 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition">
            <button onClick={prevImage} className="bg-black/50 p-2 rounded-full backdrop-blur"><ChevronLeft /></button>
            <button onClick={nextImage} className="bg-black/50 p-2 rounded-full backdrop-blur"><ChevronRight /></button>
          </div>
        )}
      </motion.div>

      {/* Conteúdo Principal */}
      <div className="relative z-20 max-w-2xl mx-auto px-6 -mt-16">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          {/* Header da Trilha */}
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">{agenda.title}</h1>
            {isSoldOut ? (
              <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-red-500/30 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                Esgotado ({maxCap} vagas totais)
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="inline-flex items-center gap-2 bg-[#25D366]/20 text-[#25D366] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-[#25D366]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
                  Vagas Abertas
                </div>
                <div className="inline-flex items-center gap-2 bg-[#F17B37]/20 text-[#F17B37] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-[#F17B37]/30">
                  {maxCap} vagas totais &bull; {remaining} restantes
                </div>
              </div>
            )}
            {/* Visualizações Simples */}
            {agenda.views !== undefined && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {agenda.views} pessoas visualizaram
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm text-center md:text-left">
              <Calendar className="text-[#F17B37] mb-2 h-6 w-6 mx-auto md:mx-0" />
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Data</p>
              <p className="font-medium text-lg">{eventDate}</p>
            </div>
            {agenda.duration_hours && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm text-center md:text-left">
                <Clock className="text-[#F17B37] mb-2 h-6 w-6 mx-auto md:mx-0" />
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Duração</p>
                <p className="font-medium text-lg">{agenda.duration_hours}h</p>
              </div>
            )}
            {agenda.distance_km && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm text-center md:text-left">
                <Navigation className="text-[#F17B37] mb-2 h-6 w-6 mx-auto md:mx-0" />
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Percurso</p>
                <p className="font-medium text-lg">{agenda.distance_km}km</p>
              </div>
            )}
            {agenda.difficulty && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm text-center md:text-left">
                <Mountain className="text-[#F17B37] mb-2 h-6 w-6 mx-auto md:mx-0" />
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Nível</p>
                <p className="font-medium text-lg capitalize">{agenda.difficulty === 'easy' ? 'Fácil' : agenda.difficulty === 'hard' ? 'Difícil' : 'Média'}</p>
              </div>
            )}
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Valor da Trilha</p>
              <p className="font-bold text-2xl text-[#25D366]">
                <span className="text-xs font-medium text-gray-500 block mb-0.5">a partir de</span>
                R$ {getLowestGrossPrice(agenda.price, agenda.taxa_gratis).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="text-[#25D366] h-10 w-10 opacity-50" />
          </div>

          {/* Navegação de Abas */}
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 backdrop-blur-md sticky top-4 z-40 shadow-2xl">
            <button 
              onClick={() => setActiveTab('roteiro')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'roteiro' ? 'bg-[#F17B37] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <FileText className="h-4 w-4" /> Roteiro
            </button>
            <button 
              onClick={() => setActiveTab('embarque')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'embarque' ? 'bg-[#F17B37] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <MapPin className="h-4 w-4" /> Embarque
            </button>
            <button 
              onClick={() => setActiveTab('galeria')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'galeria' ? 'bg-[#F17B37] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <ImageIcon className="h-4 w-4" /> Galeria
            </button>
          </div>

          {/* Área de Conteúdo das Abas */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              
              {/* ABA: ROTEIRO */}
              {activeTab === 'roteiro' && (
                <motion.div 
                  key="roteiro"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="bg-[#151D2A] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl max-h-[60vh] overflow-y-auto dark-scrollbar">
                    <h3 className="text-xl font-bold mb-6 text-[#F17B37] flex items-center gap-2">
                      <Info className="h-5 w-5" /> Detalhes da Aventura
                    </h3>
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-base md:text-lg">
                      {agenda.description}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ABA: EMBARQUE */}
              {activeTab === 'embarque' && (
                <motion.div 
                  key="embarque"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="bg-[#151D2A] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl max-h-[60vh] overflow-y-auto dark-scrollbar">
                    <h3 className="text-xl font-bold mb-6 text-[#F17B37] flex items-center gap-2">
                      <MapPin className="h-5 w-5" /> Locais de Embarque
                    </h3>
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-base md:text-lg">
                      {agenda.meeting_point}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ABA: GALERIA */}
              {activeTab === 'galeria' && (
                <motion.div 
                  key="galeria"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 max-h-[60vh] overflow-y-auto dark-scrollbar pr-2"
                >
                  {agenda.video_url && (
                    <div className="bg-[#151D2A] border border-white/5 rounded-3xl p-4 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-[#F17B37] flex items-center gap-2 px-2">
                        <VideoIcon className="h-5 w-5" /> Vídeo Promocional
                      </h3>
                      <div className="rounded-2xl overflow-hidden border border-white/10 aspect-video relative bg-black">
                        <video 
                          src={agenda.video_url} 
                          controls 
                          className="w-full h-full object-contain"
                          controlsList="nodownload"
                          preload="metadata"
                        >
                          Seu navegador não suporta a exibição deste vídeo.
                        </video>
                      </div>
                    </div>
                  )}

                  {agenda.images && agenda.images.length > 0 && (
                    <div className="bg-[#151D2A] border border-white/5 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-[#F17B37] flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" /> Fotos do Local
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {agenda.images.map((img: string, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => setLightboxIndex(idx)}
                            className="aspect-square rounded-xl overflow-hidden border border-white/10 group cursor-pointer"
                          >
                            <img src={img} alt={`Foto ${idx+1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!agenda.images || agenda.images.length === 0) && !agenda.video_url && (
                    <div className="text-center py-12 text-gray-500">
                      Nenhuma mídia disponível para esta trilha no momento.
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
          
        </motion.div>
      </div>

      {/* Footer Fixo */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0F1722] via-[#0F1722] to-transparent z-40"
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <div className="flex gap-2">
            {isSoldOut ? (
              <button 
                disabled
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/80 text-white p-4 rounded-2xl font-bold text-lg shadow-lg cursor-not-allowed opacity-80"
              >
                <X className="h-6 w-6" />
                Vagas Esgotadas
              </button>
            ) : (
              <button 
                onClick={handleComprar}
                className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white p-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#20b858] hover:scale-[1.02] transition-all"
              >
                <CheckCircle2 className="h-6 w-6" />
                Comprar
              </button>
            )}

            <a 
              href={`https://wa.me/5531998793939?text=Oi Nívea! Tenho uma dúvida sobre a trilha: ${agenda.title}`}
              target="_blank"
              rel="noreferrer"
              className="flex-none flex items-center justify-center bg-[#25D366] text-white p-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all"
              title="Falar no WhatsApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </a>
            
            <button 
              onClick={handleShare}
              className="flex-none flex items-center justify-center bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all border border-white/10"
              title="Compartilhar Trilha"
            >
              <Send className="h-6 w-6" />
            </button>
            
            <a 
              href="https://www.instagram.com/maistrilhamenosestresse/"
              target="_blank"
              rel="noreferrer"
              className="flex-none flex items-center justify-center bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white p-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all"
              title="Siga no Instagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
          </div>
        </div>
      </motion.div>

      {/* LIGHTBOX DE FOTOS */}
      <AnimatePresence>
        {lightboxIndex !== null && agenda.images && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Fechar */}
            <button 
              onClick={() => setLightboxIndex(null)}
              className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition z-50"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Anterior */}
            {lightboxIndex > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-4 md:left-8 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full transition z-50"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {/* Próxima */}
            {lightboxIndex < agenda.images.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-4 md:right-8 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full transition z-50"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}

            {/* Imagem */}
            <motion.img
              key={lightboxIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={agenda.images[lightboxIndex]}
              alt="Foto Expandida"
              className="w-full h-full object-contain max-w-5xl mx-auto p-4 cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Indicador */}
            <div className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-sm font-bold tracking-widest z-50 bg-black/40 py-1 w-24 mx-auto rounded-full backdrop-blur">
              {lightboxIndex + 1} / {agenda.images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
