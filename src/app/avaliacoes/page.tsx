"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageCircle, X, CheckCircle, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";

export default function AvaliacoesPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = "5531998793939"; // Nívea's number
    const text = `*Nova Avaliação - Mais Trilha* 🌟\n\n*Nome:* ${name}\n*Nota:* ${rating} Estrelas\n*Comentário:* "${comment}"\n\n(Copie este depoimento para postar no site pelo Editor Visual!)`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setIsModalOpen(false);
    setName("");
    setComment("");
    setRating(5);
  };

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans selection:bg-[#F17B37] selection:text-white pb-20 overflow-hidden relative">
      <Navigation />
      
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <header className="pt-24 pb-12 px-6 max-w-7xl mx-auto relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6 backdrop-blur-md"
        >
          <span className="text-[#F17B37] text-sm font-bold tracking-widest uppercase" data-cms-editable="true">Prova Social</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight"
          data-cms-editable="true"
        >
          O que nossos <span className="text-[#F17B37]">aventureiros</span> dizem
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10"
          data-cms-editable="true"
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

      {/* Mural de Depoimentos (Editáveis pelo CMS) */}
      <div className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          
          {/* Depoimento 1 */}
          <motion.div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] break-inside-avoid backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex gap-1 text-[#F17B37] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
            </div>
            <p className="text-gray-200 text-lg italic leading-relaxed mb-6" data-cms-editable="true">
              "Foi uma experiência surreal! Nunca achei que conseguiria completar uma trilha tão desafiadora, mas o apoio do grupo e da Nívea fez toda a diferença. Mudou minha vida!"
            </p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#F17B37] to-purple-600 flex items-center justify-center text-xl font-bold">M</div>
              <div>
                <p className="font-bold text-white" data-cms-editable="true">Mariana Silva</p>
                <p className="text-sm text-gray-500" data-cms-editable="true">Trilha do Tabuleiro</p>
              </div>
            </div>
          </motion.div>

          {/* Depoimento 2 */}
          <motion.div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] break-inside-avoid backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex gap-1 text-[#F17B37] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
            </div>
            <p className="text-gray-200 text-lg italic leading-relaxed mb-6" data-cms-editable="true">
              "Organização impecável. Desde o ponto de encontro até o retorno, tudo foi pensado nos mínimos detalhes. A energia da galera é contagiante!"
            </p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#25D366] to-teal-600 flex items-center justify-center text-xl font-bold">R</div>
              <div>
                <p className="font-bold text-white" data-cms-editable="true">Rafael Costa</p>
                <p className="text-sm text-gray-500" data-cms-editable="true">Pico da Bandeira</p>
              </div>
            </div>
          </motion.div>

          {/* Depoimento 3 */}
          <motion.div className="bg-[#151D2A] border border-[#F17B37]/30 p-6 md:p-8 rounded-[2rem] break-inside-avoid shadow-[0_0_30px_rgba(241,123,55,0.1)] hover:shadow-[0_0_40px_rgba(241,123,55,0.2)] transition-shadow">
            <div className="flex gap-1 text-[#F17B37] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
            </div>
            <p className="text-white text-xl font-medium italic leading-relaxed mb-6" data-cms-editable="true">
              "O Mais Trilha não é só turismo de aventura, é uma família. A Nívea tem um dom de conectar pessoas à natureza de uma forma profunda."
            </p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-xl font-bold">C</div>
              <div>
                <p className="font-bold text-white" data-cms-editable="true">Camila Ferreira</p>
                <p className="text-sm text-[#F17B37]" data-cms-editable="true">Aventureira Frequente</p>
              </div>
            </div>
          </motion.div>

          {/* Depoimento 4 */}
          <motion.div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] break-inside-avoid backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex gap-1 text-[#F17B37] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
            </div>
            <p className="text-gray-200 text-lg italic leading-relaxed mb-6" data-cms-editable="true">
              "Fui sozinho e voltei com 20 novos amigos. A segurança durante a trilha me deixou muito tranquilo. Recomendo de olhos fechados!"
            </p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-xl font-bold">L</div>
              <div>
                <p className="font-bold text-white" data-cms-editable="true">Lucas Almeida</p>
                <p className="text-sm text-gray-500" data-cms-editable="true">Cachoeira Alta</p>
              </div>
            </div>
          </motion.div>

        </div>
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
              className="bg-[#151D2A] border border-white/10 rounded-[2rem] p-6 md:p-10 max-w-lg w-full relative shadow-2xl"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-3xl font-black mb-2 text-white">Deixe sua Avaliação</h2>
              <p className="text-gray-400 mb-8">Conte-nos como foi a sua experiência com o Mais Trilha.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Sua Nota</label>
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
                  <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Seu Nome</label>
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
                  <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Como foi a experiência?</label>
                  <textarea
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F17B37] transition-colors resize-none"
                    placeholder="Escreva seu depoimento aqui..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F17B37] hover:bg-[#e06925] text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(241,123,55,0.3)] hover:shadow-[0_0_30px_rgba(241,123,55,0.5)] flex items-center justify-center gap-2 mt-4"
                >
                  <CheckCircle className="h-5 w-5" /> Enviar para Aprovação
                </button>
                <p className="text-xs text-gray-500 text-center mt-4">
                  Sua avaliação será enviada para nossa equipe e em breve aparecerá no site!
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
