"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Image as ImageIcon, MessageCircle, Map, Globe, PenSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function FireParticles() {
  const [particles, setParticles] = useState<{ id: number; size: number; left: number; color: string; duration: number; delay: number }[]>([]);

  useEffect(() => {
    const cols = ["#F17B37", "#FFB347", "#ffffff"];
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      size: Math.random() * 6 + 2,
      left: Math.random() * 100,
      color: cols[Math.floor(Math.random() * 3)],
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: "100vh", opacity: 0, scale: 0 }}
          animate={{
            y: "-10vh",
            opacity: [0, 0.6, 0.2, 0],
            scale: 1,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

export default function BioPage() {
  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans relative overflow-x-hidden flex flex-col items-center justify-center p-6 pb-12">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 opacity-40">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-[#F17B37] rounded-full blur-[120px] mix-blend-screen opacity-20 animate-pulse" />
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-[#FFB347] rounded-full blur-[100px] mix-blend-screen opacity-10" />
      </div>

      <FireParticles />

      <main className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center pt-8">
        {/* Profile Image */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative mb-6"
        >
          <div className="w-28 h-28 rounded-full p-[3px] bg-gradient-to-tr from-[#F17B37] to-[#FFB347] animate-[spin_4s_linear_infinite]" style={{ animationDirection: 'reverse' }}>
            <div className="w-full h-full bg-[#0F1722] rounded-full flex items-center justify-center p-1 relative overflow-hidden animate-[spin_4s_linear_infinite]">
              <Image
                src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/bio/Gemini_Generated_Image_gzfrdngzfrdngzfr.png"
                alt="Mais Trilha Menos Estresse"
                fill
                className="rounded-full object-cover"
              />
            </div>
          </div>
          {/* Online Badge */}
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#25D366] border-2 border-[#0F1722] rounded-full animate-pulse shadow-[0_0_10px_rgba(37,211,102,0.8)]" />
        </motion.div>

        {/* Header Text */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-[#F17B37] bg-clip-text text-transparent">
            Mais Trilha<br/>Menos Estresse
          </h1>
          <p className="text-white/60 text-sm mt-2 font-medium">🌿 Natureza · Aventura · Comunidade</p>
        </motion.div>

        {/* Links */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full flex flex-col gap-3"
        >
          {/* Main Site */}
          <Link href="/" className="group flex items-center bg-white/5 border border-white/10 hover:bg-white/10 p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95">
            <div className="bg-[#0F1722] p-3 rounded-xl mr-3 group-hover:bg-[#F17B37] transition-colors">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Site Oficial</strong>
              <small className="text-white/50 text-xs">Conheça nossa história e missões</small>
            </div>
          </Link>

          {/* Agenda */}
          <Link href="/agenda" className="group flex items-center bg-gradient-to-r from-[#F17B37] to-[#d86629] p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-[#F17B37]/20">
            <div className="bg-[#0F1722]/20 p-3 rounded-xl mr-3">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Expedição de Trilhas</strong>
              <small className="text-white/80 text-xs">Veja nossa agenda de aventuras</small>
            </div>
          </Link>

          {/* Cadastro */}
          <Link href="/cadastro" className="group flex items-center bg-white/5 border border-white/10 hover:bg-white/10 p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95">
            <div className="bg-[#0F1722] p-3 rounded-xl mr-3 group-hover:bg-[#F17B37] transition-colors">
              <PenSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Cadastro de Aventureiro</strong>
              <small className="text-white/50 text-xs">Preencha sua ficha médica e termo</small>
            </div>
          </Link>

          {/* Album */}
          <Link href="/bio/album.html" className="group flex items-center bg-white/5 border border-white/10 hover:bg-white/10 p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-[#FFD700] text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Novo</div>
            <div className="bg-[#0F1722] p-3 rounded-xl mr-3 group-hover:bg-[#F17B37] transition-colors">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Álbum de Fotos</strong>
              <small className="text-white/50 text-xs">Veja todas as fotos e vídeos</small>
            </div>
          </Link>

          {/* Group WhatsApp */}
          <a href="https://chat.whatsapp.com/KNXbACKaKtN8CubdE62jrD?mode=wwc" target="_blank" rel="noopener noreferrer" className="group flex items-center bg-gradient-to-r from-[#075e54] to-[#128c7e] p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-[#25D366]/10">
            <div className="bg-black/20 p-3 rounded-xl mr-3">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Grupo WhatsApp</strong>
              <small className="text-white/80 text-xs">Participe da nossa comunidade</small>
            </div>
          </a>

          {/* Nivea WhatsApp */}
          <a href="https://wa.me/5531998793939" target="_blank" rel="noopener noreferrer" className="group flex items-center bg-white/5 border border-white/10 hover:bg-white/10 p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-95">
            <div className="bg-[#0F1722] p-3 rounded-xl mr-3 group-hover:bg-[#25D366] transition-colors">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 py-2 text-left">
              <strong className="block text-[15px] font-semibold text-white">Fale com a Nívea</strong>
              <small className="text-white/50 text-xs">Orçamentos e dúvidas diretas</small>
            </div>
          </a>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 flex flex-col items-center gap-4"
        >
          <div className="flex gap-4">
            <a href="https://www.instagram.com/maistrilhamenosestresse?igsh=bne4m2lpbnbjc3lq" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
              <Camera className="w-4 h-4" /> Instagram
            </a>
          </div>
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Mais Trilha Menos Estresse</p>
        </motion.div>
      </main>
    </div>
  );
}
