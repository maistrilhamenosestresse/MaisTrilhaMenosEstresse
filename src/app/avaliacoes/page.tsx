"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageCircle, X, CheckCircle, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { supabase } from "@/lib/supabase";

export default function AvaliacoesPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState("");
  const [trailName, setTrailName] = useState("");
  const [comment, setComment] = useState("");
  
  const [agendas, setAgendas] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const renderComment = (comment: string) => {
    const match = comment.match(/^\[Trilha:\s*(.*?)\]\n?([\s\S]*)$/);
    if (match) {
      return { trail: match[1], actualComment: match[2].trim() };
    }
    return { trail: null, actualComment: comment };
  };

const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Busca Agendas (apenas passadas ou todas para permitir avaliação de trilhas já feitas)
      const { data: agendasData } = await supabase
        .from('agendas')
        .select('id, title, date')
        .order('date', { ascending: false });
        
      if (agendasData) {
        setAgendas(agendasData);
      }

      // Busca Avaliações Aprovadas
      const { data: avaliacoesData } = await supabase
        .from('avaliacoes')
        .select(`
          *,
          agendas ( title )
        `)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (avaliacoesData) {
        setAvaliacoes(avaliacoesData);
      }
      
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('avaliacoes').insert([{
        name: name,
        rating: rating,
        comment: trailName.trim() ? `[Trilha: ${trailName}]\n${comment}` : comment,
        approved: false // Vai pro painel admin
      }]);

      if (error) throw error;

      setSuccessMessage(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage(false);
        setName("");
        setComment("");
        setRating(5);
        setTrailName("");
      }, 3000);
      
    } catch (err: any) {
      alert("Erro ao enviar avaliação: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (fullName: string) => {
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const colors = [
    'from-[#F17B37] to-purple-600',
    'from-[#25D366] to-teal-600',
    'from-pink-500 to-orange-400',
    'from-blue-500 to-cyan-500',
    'from-yellow-400 to-orange-500'
  ];

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans selection:bg-[#F17B37] selection:text-white pb-20 overflow-hidden relative">
      <Navigation />
      
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <header className="pt-36 pb-12 px-6 max-w-7xl mx-auto relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6 backdrop-blur-md"
        >
          <span className="text-[#F17B37] text-sm font-bold tracking-widest uppercase">Prova Social</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight"
        >
          O que nossos <span className="text-[#F17B37]">aventureiros</span> dizem
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10"
        >
          A melhor forma de entender a magia do Mais Trilha é através dos olhos de quem já viveu essa experiência.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setIsModalOpen(true)}
          className="bg-[#F17B37] hover:bg-[#e06925] text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_30px_rgba(241,123,55,0.4)] hover:shadow-[0_0_50px_rgba(241,123,55,0.6)] inline-flex items-center gap-3 hover:scale-105"
        >
          <MessageCircle className="h-5 w-5" /> Deixar minha Avaliação
        </motion.button>
      </header>

      {/* Mural de Depoimentos */}
      <div className="px-6 max-w-7xl mx-auto relative z-10">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#F17B37]" />
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-sm">
            <Star className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Seja o primeiro a avaliar!</h2>
            <p className="text-gray-400">Nenhuma avaliação foi aprovada ainda.</p>
          </div>
        ) : (() => {
            const totalPages = Math.ceil(avaliacoes.length / ITEMS_PER_PAGE);
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const currentAvaliacoes = avaliacoes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            
            return (
              <>
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                  {currentAvaliacoes.map((av, index) => {
                    const { trail, actualComment } = renderComment(av.comment);
                    return (
                      <motion.div 
                        key={av.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] break-inside-avoid backdrop-blur-sm hover:bg-white/10 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-1 text-[#F17B37]">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < av.rating ? 'fill-current' : 'text-gray-600'}`} />
                            ))}
                          </div>
                        </div>
                        
                        {trail && (
                          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-[#F17B37]/10 border border-[#F17B37]/20 text-[#F17B37]">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm font-bold">{trail}</span>
                          </div>
                        )}
                        
                        <p className="text-gray-200 text-lg italic leading-relaxed mb-6">
                          "{actualComment}"
                        </p>
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-full bg-gradient-to-tr ${colors[index % colors.length]} flex items-center justify-center text-xl font-bold`}>
                            {getInitials(av.name)}
                          </div>
                          <div>
                            <p className="font-bold text-white">{av.name}</p>
                            {av.agendas && !trail && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {av.agendas.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-12">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1} 
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 hover:bg-white/10 transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                       <button 
                        key={i} 
                        onClick={() => setCurrentPage(i + 1)} 
                        className={`w-10 h-10 rounded-xl font-bold transition ${currentPage === i + 1 ? 'bg-[#F17B37] text-white shadow-[0_0_15px_rgba(241,123,55,0.4)]' : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'}`}
                       >
                         {i + 1}
                       </button>
                    ))}
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages} 
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 hover:bg-white/10 transition"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </>
            );
          })()
        }
      </div>

      {/* Modal de Avaliação */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#151D2A] border border-white/10 rounded-[2rem] p-6 md:p-8 max-w-lg w-full relative shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-3xl font-black mb-2 text-white">Deixe sua Avaliação</h2>
              <p className="text-gray-400 mb-6">Conte-nos como foi a sua experiência com o Mais Trilha.</p>

              {successMessage ? (
                <div className="bg-[#25D366]/20 border border-[#25D366]/40 p-8 rounded-2xl text-center">
                  <CheckCircle className="h-16 w-16 text-[#25D366] mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Muito Obrigado!</h3>
                  <p className="text-gray-300">Sua avaliação foi enviada e está em análise pela nossa equipe. Em breve ela aparecerá no site!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Sua Nota</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star
                            className={`h-10 w-10 ${
                              star <= (hoveredRating || rating)
                                ? "fill-[#F17B37] text-[#F17B37]"
                                : "text-gray-600"
                            } transition-colors duration-200`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Seu Nome</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F17B37] transition-colors"
                      placeholder="Como você quer ser chamado?"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Qual trilha você fez?</label>
                    <input
                      type="text"
                      placeholder="Ex: Pico da Bandeira"
                      value={trailName}
                      onChange={(e) => setTrailName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F17B37] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Como foi a experiência?</label>
                    <textarea
                      required
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F17B37] transition-colors resize-none"
                      placeholder="Escreva seu depoimento aqui..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#F17B37] hover:bg-[#e06925] disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(241,123,55,0.3)] hover:shadow-[0_0_30px_rgba(241,123,55,0.5)] flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5" /> Enviar para Aprovação</>}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Sua avaliação será revisada para garantir que nossas políticas sejam cumpridas.
                  </p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
