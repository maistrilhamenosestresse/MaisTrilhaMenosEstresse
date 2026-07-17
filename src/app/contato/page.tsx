"use client";

import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { MessageCircle, MapPin, Mail } from "lucide-react";

export default function ContatoPage() {
  return (
    <div className="bg-[#0F1722] text-white min-h-screen overflow-x-hidden font-sans selection:bg-[#F17B37] selection:text-white pb-20 relative">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 flex flex-col items-center justify-center min-h-[60vh] text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#F17B37]/10 via-[#0F1722]/80 to-[#0F1722] z-0" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <h2 className="text-[#F17B37] font-bold tracking-[0.3em] uppercase text-sm mb-6 drop-shadow-lg">Fale Conosco</h2>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1] mb-8 drop-shadow-2xl">
            Pronto para sua <br/> próxima <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F17B37] to-amber-500">aventura?</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
            Tem dúvidas sobre roteiros, quer sugerir um destino ou precisa de ajuda com sua reserva?
            Nossa equipe está pronta para te atender.
          </p>
        </motion.div>
      </section>

      {/* Contact Cards */}
      <section className="py-10 px-6 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* WhatsApp Card */}
          <motion.a
            href="https://wa.me/5531998793939?text=Oi Nívea! Quero saber mais sobre o Mais Trilha!"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group bg-white/5 border border-white/10 p-10 rounded-[2rem] backdrop-blur-md hover:bg-white/10 hover:border-[#25D366]/50 transition-all duration-300 flex flex-col items-center text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-[#25D366]/20 rounded-full flex items-center justify-center text-[#25D366] mb-6 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">WhatsApp</h3>
            <p className="text-gray-400 mb-6">
              Fale diretamente com a Nívea para tirar dúvidas rápidas ou entrar no nosso grupo VIP.
            </p>
            <span className="inline-flex items-center gap-2 text-[#25D366] font-bold">
              Chamar no Zap <MessageCircle className="w-4 h-4" />
            </span>
          </motion.a>

          {/* Instagram Card */}
          <motion.a
            href="https://www.instagram.com/maistrilhamenosestresse/"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="group bg-white/5 border border-white/10 p-10 rounded-[2rem] backdrop-blur-md hover:bg-white/10 hover:border-pink-500/50 transition-all duration-300 flex flex-col items-center text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-500 mb-6 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </div>
            <h3 className="text-2xl font-black text-white mb-4">Instagram</h3>
            <p className="text-gray-400 mb-6">
              Acompanhe nossas fotos, vídeos e novidades. Marque a gente nas suas aventuras!
            </p>
            <span className="inline-flex items-center gap-2 text-pink-500 font-bold">
              @maistrilhamenosestresse <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </span>
          </motion.a>

        </div>
      </section>

      {/* Footer simplificado */}
      <footer className="mt-32 border-t border-white/10 pt-10 text-center text-gray-500 text-sm flex flex-col items-center gap-4">
        <img
          src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/logo/rodape.JPG"
          alt="Montanhas Mais Trilha"
          className="h-12 w-auto mix-blend-screen opacity-50"
          style={{ filter: 'contrast(1.8) brightness(0.8)' }}
        />
        <p>© {new Date().getFullYear()} Todos os direitos reservados a Mais Trilha Menos Estresse.</p>
      </footer>
    </div>
  );
}
