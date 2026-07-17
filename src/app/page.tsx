/**
 * @file page.tsx
 * @description Página principal (Landing Page) da Mais Trilha Menos Estresse.
 *              Exibe o carrossel, depoimentos animados e integração com o sistema de checkout.
 * @module LandingPage
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronDown, ArrowRight, TreePine, Map, Users, Heart, X, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";

/**
 * @function LandingPage
 * @description Renderiza a página principal do site, controlando as animações de scroll (Framer Motion) e os vídeos de fundo.
 * @returns {JSX.Element} Componente React renderizado da Landing Page.
 */
export default function LandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [particles, setParticles] = useState<any[]>([]);
  const [sparks, setSparks] = useState<any[]>([]);
  const [showAllComunidade, setShowAllComunidade] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const comunidadeImages = [
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_9320%20-%20Copia.JPG",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_0997.JPG",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/PESSOAS%20ESPECIAIS/1647fade-8f9e-4eca-9cb9-bbf9b3fb26b6.jpg",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/5e7df681-58d1-48ae-a6bc-1c9e57a3bcd0.jpg",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_8197.webp",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/PESSOAS%20ESPECIAIS/IMG_1809.webp",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_8162%20-%20Copia.webp",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_9430%20-%20Copia.JPG",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_5987.webp",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Grupo/IMG_6178.webp",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/PESSOAS%20ESPECIAIS/59b3598c-060a-48c1-a372-894e60c16d63%20Copy.JPG",
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/PESSOAS%20ESPECIAIS/IMG_5466.webp"
  ];
  const visibleImages = showAllComunidade ? comunidadeImages : comunidadeImages.slice(0, 3);

  // Lógica para a seta de scroll global inteligente
  const sections = ['hero', 'essencia-1', 'essencia-2', 'essencia-3', 'olhares', 'comunidade', 'footer'];
  const scrollToNextSection = () => {
    if (typeof window === 'undefined') return;
    const scrollPosition = window.scrollY;

    for (let i = 0; i < sections.length; i++) {
      const el = document.getElementById(sections[i]);
      if (el) {
        // Calcula a posição absoluta da seção e desconta um offset dinâmico para o Menu Fixo não cobrir o topo
        const offset = window.innerWidth < 768 ? 20 : 100; // Offset pequeno no mobile (menu absoluto), 100px no desktop (menu fixo)
        const absoluteTop = el.getBoundingClientRect().top + scrollPosition - offset;
        // Pula para a próxima seção que está abaixo da posição atual
        if (absoluteTop > scrollPosition + 10) {
          window.scrollTo({ top: absoluteTop, behavior: 'smooth' });
          break;
        }
      }
    }
  };

  useEffect(() => {
    setIsClient(true);
    setParticles([...Array(50)].map(() => ({
      size: Math.random() * 3 + 2,
      isOrange: Math.random() > 0.6,
      initialX: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
      initialY: Math.random() * 800,
      animY: Math.random() * -300 - 100,
      animX: Math.random() * 200 - 100,
      animOpacity: Math.random() * 0.8 + 0.2,
      duration: Math.random() * 15 + 10
    })));
    setSparks([...Array(8)].map(() => ({
      size: Math.random() * 3 + 2,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animY: Math.random() * -60 - 20,
      animX: (Math.random() - 0.5) * 40,
      animOpacity: Math.random() * 0.8 + 0.2,
      duration: Math.random() * 2 + 2,
      delay: Math.random() * 2
    })));
  }, []);

  // Parallax Setup
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const heroOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(smoothProgress, [0, 0.2], [1, 1.1]);
  const heroY = useTransform(smoothProgress, [0, 0.2], [0, 100]);

  // Gallery Parallax
  const y1 = useTransform(smoothProgress, [0, 1], [0, -100]);
  const y2 = useTransform(smoothProgress, [0, 1], [0, -250]);
  const y3 = useTransform(smoothProgress, [0, 1], [0, -150]);

  // Slideshow Fundadoras
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideImages = [
    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/WhatsApp%20Image%202026-06-26%20at%2010.39.37%20(1).jpeg",

    "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/IMG_0521.JPG",

  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 4000); // 4 seconds per slide
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#0F1722] text-white min-h-screen overflow-x-hidden font-sans selection:bg-[#F17B37] selection:text-white">


      {/* 1. HERO SECTION */}
      <section
        id="hero"
        className="relative h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden md:snap-start"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-150 mix-blend-overlay"
        >
          <source src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[#0F1722]/40 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0F1722]/20 to-[#0F1722] z-10 pointer-events-none" />

        <div className="relative z-20 text-center max-w-4xl px-6 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
          >
            <h1 className="font-black tracking-tighter leading-[1.1] mb-6 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              <span className="block text-2xl md:text-4xl lg:text-5xl md:whitespace-nowrap mb-2 md:mb-4 text-white/90">Mais Trilha Menos Estresse.</span>
              <span className="block text-4xl md:text-6xl lg:text-7xl">
                Descubra uma <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F17B37] to-[#f9a03f]">coragem que você nem sabia que existia</span>.
              </span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className="text-lg md:text-2xl text-gray-200 font-medium max-w-2xl mb-12 leading-relaxed drop-shadow-lg"
          >
            Uma conexão indescritível com a natureza. Superação, encontros reais e paisagens que mudam a forma como você vê o mundo.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            onClick={() => router.push('/agenda')}
            className="group relative inline-flex items-center justify-center gap-3 bg-white text-[#0F1722] px-8 py-4 rounded-full font-black text-lg overflow-hidden hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(241,123,55,0.5)]"
          >
            <span className="relative z-10 flex items-center gap-2">Começar Aventura <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></span>
          </motion.button>
        </div>
      </section>

      {/* 2. A HISTÓRIA (NÍVEA E AS FUNDADORAS) */}
      <section id="essencia" className="py-16 md:py-24 px-6 relative z-20 bg-[#0F1722] overflow-hidden md:snap-start">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#F17B37]/5 via-[#0F1722]/80 to-[#0F1722] z-0" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-16 text-center"
          >
            <h2 className="text-[#F17B37] font-bold tracking-[0.3em] uppercase text-xs mb-6 drop-shadow-lg">A Nossa Essência</h2>
            <h3 className="text-5xl md:text-7xl font-black tracking-tight text-white drop-shadow-2xl">Como tudo começou</h3>
          </motion.div>

          {/* Intro Nivea */}
          <div id="essencia-1" className="flex flex-col md:flex-row gap-12 md:gap-16 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="flex-1 space-y-6"
            >
              <p className="text-2xl leading-relaxed text-gray-300 font-light">
                Me chamo <strong className="text-white font-medium">Nívea Maria</strong>... tenho 35 anos... e há 3 anos venho me desafiando no mundo do ecoturismo.
              </p>
              <p className="text-xl leading-relaxed text-gray-400 font-light">
                Sempre tive uma conexão muito forte com a natureza. Gosto do simples, do essencial. Na minha família, o hábito de acampar sempre foi muito forte. Aquele universo me encantava.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 3 }}
              whileInView={{ opacity: 1, scale: 1, rotate: -2 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, type: "spring" }}
              whileHover={{ scale: 1.05, rotate: 0 }}
              className="flex-1 w-full relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-[0_0_60px_rgba(241,123,55,0.15)] ring-1 ring-white/10 group"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10 pointer-events-none" />
              <Image src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/WhatsApp%20Image%202026-06-26%20at%2010.28.20.jpeg" alt="Nívea na Cachoeira" width={800} height={800} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-1000 ease-out" />
              <div className="absolute bottom-8 left-8 z-20">
                <p className="font-black text-3xl text-white drop-shadow-lg">Nívea</p>
                <p className="text-[#F17B37] text-sm font-bold uppercase tracking-widest mt-1 drop-shadow-md">A Fundadora</p>
              </div>
            </motion.div>
          </div>

          {/* O Despertar (Bandeira) */}
          <motion.div
            id="essencia-2"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-center max-w-4xl mx-auto mb-20 relative"
          >
            <div className="absolute -inset-10 bg-gradient-to-r from-transparent via-[#F17B37]/10 to-transparent blur-3xl z-0" />
            <p className="text-3xl md:text-4xl font-light leading-relaxed italic text-gray-100 relative z-10 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
              "Mesmo com esse sonho dentro de mim... por muito tempo acreditei que aquilo não era pra mim. Que não era para uma mulher... casada... mãe... aos 32 anos."
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="mt-16 relative aspect-[4/5] md:aspect-[16/10] rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group"
            >
              <Image src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/IMG_3883.webp" alt="Nívea com a Bandeira" width={800} height={800} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            </motion.div>
          </motion.div>

          {/* As Fundadoras */}
          <div id="essencia-3" className="flex flex-col md:flex-row-reverse gap-16 md:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="flex-1 space-y-6"
            >
              <p className="text-2xl leading-relaxed text-gray-300 font-light">
                Tive a ideia de convidar meu tio para refazer uma trilha muito especial: a Cachoeira do Tabuleiro. Ele não pôde ir, então decidi ir sozinha. Ou pelo menos, essa era a ideia.
              </p>
              <p className="text-xl leading-relaxed text-gray-400 font-light">
                Contei para uma amiga, que chamou outra, e de repente minha mãe e minha tia Juma também estavam dentro. Lá estávamos nós: <strong className="text-white font-medium">cinco mulheres</strong> de madrugada, dentro de um carro, prontas para viver algo que mudaria tudo.
              </p>
              <p className="text-xl leading-relaxed text-[#F17B37] font-medium drop-shadow-md">
                Enfrentamos frio, perrengues, mas nada impediu de ser uma das maiores experiências das nossas vidas. Foi ali que descobri uma coragem que nem sabia que existia em mim.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 2 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, type: "spring" }}
              className="flex-1 w-full relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-[0_0_60px_rgba(255,255,255,0.05)] ring-1 ring-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent z-10 pointer-events-none" />

              {slideImages.map((src, index) => (
                <motion.img
                  key={src}
                  src={src}
                  alt="Fundadoras e Nívea"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{
                    opacity: currentSlide === index ? 1 : 0,
                    scale: currentSlide === index ? 1.05 : 1
                  }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute inset-0 object-cover w-full h-full"
                />
              ))}

              <div className="absolute bottom-8 left-8 z-20">
                <p className="font-black text-3xl text-white drop-shadow-lg">A Origem</p>
                <p className="text-gray-300 text-sm font-bold uppercase tracking-widest mt-1">Nívea e as Fundadoras</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO "OLHARES" (CINEMATOGRÁFICO) */}
      <section id="olhares" className="py-40 relative bg-black overflow-hidden flex flex-col items-center justify-center min-h-[90vh] md:snap-start">
        <motion.div className="absolute inset-0 opacity-40" style={{ y: y3 }}>
          <Image src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/IMG_6341.webp" alt="Background Olhares" width={800} height={800} className="w-full h-[120%] object-cover blur-md scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
        </motion.div>

        {/* PARTÍCULAS DO FUNDO - RESTRITAS A ESSE CONTAINER - SOMENTE NO CLIENTE PARA EVITAR ERRO DE HYDRATION */}
        {isClient && particles.length > 0 && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {particles.map((p, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.isOrange ? '#F17B37' : '#ffffff',
                    boxShadow: p.isOrange ? '0 0 10px #F17B37' : '0 0 5px #ffffff',
                    filter: 'blur(1px)'
                  }}
                  initial={{
                    x: p.initialX,
                    y: p.initialY,
                    opacity: 0,
                  }}
                  animate={{
                    y: [null, p.animY],
                    x: [null, p.animX],
                    opacity: [0, p.animOpacity, 0],
                  }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )
            )}
          </div>
        )}

        <div className="relative z-10 text-center max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <Heart className="h-12 w-12 text-[#F17B37] mx-auto mb-10 opacity-80 drop-shadow-[0_0_15px_rgba(241,123,55,0.5)]" />
            <h2 className="text-5xl md:text-8xl font-black mb-10 leading-[0.9] drop-shadow-2xl">
              Os Olhares <br /> que constroem.
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 font-light leading-relaxed mb-16 drop-shadow-lg max-w-4xl mx-auto italic border-l-4 border-[#F17B37] pl-6 text-left">
              "Esta é uma dedicação silenciosa e profunda àqueles que fazem o grupo diariamente. Aqueles cujos passos já marcaram tantas trilhas conosco, cujos olhares viram o sol nascer e se pôr nas montanhas mais difíceis. Vocês são o sangue e o fôlego do Mais Trilha. A força que nos move a cada novo cume."
            </p>

            <div className="relative inline-block">
              {/* Partículas destacando o botão - APENAS NO CLIENTE */}
              {isClient && sparks.length > 0 && (
                <div className="absolute -inset-10 pointer-events-none z-0">
                  {sparks.map((s, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full bg-[#F17B37]"
                      style={{
                        width: s.size,
                        height: s.size,
                        boxShadow: '0 0 8px 2px #F17B37',
                      }}
                      initial={{
                        x: '50%', y: '50%', opacity: 0,
                        left: s.left, top: s.top
                      }}
                      animate={{
                        y: [0, s.animY],
                        x: [0, s.animX],
                        opacity: [0, s.animOpacity, 0],
                        scale: [0.5, 1.5, 0.5]
                      }}
                      transition={{
                        duration: s.duration,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: s.delay
                      }}
                    />
                  ))}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/olhares')}
                className="relative z-10 inline-flex items-center gap-3 bg-transparent border-2 border-white/20 hover:border-[#F17B37] hover:bg-[#F17B37]/10 text-white px-8 py-4 rounded-full font-medium text-lg transition-all"
              >
                Dedique um momento a eles <ArrowRight className="h-5 w-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. GALERIA COMUNIDADE E PESSOAS ESPECIAIS (MASONRY REAL) */}
      <section id="comunidade" className="py-32 px-6 bg-[#0F1722] relative overflow-hidden md:snap-start min-h-screen flex flex-col justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white/5 to-[#0F1722] z-0" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black mb-4 drop-shadow-xl">Nossa Comunidade</h2>
            <p className="text-xl text-gray-400">Momentos inesquecíveis vividos juntos.</p>
          </div>

          <motion.div layout className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimatePresence>
              {visibleImages.map((src, idx) => (
                <motion.div
                  key={src}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.4 }}
                  className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 cursor-pointer aspect-[4/5]"
                  whileHover={{ scale: 0.98 }}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <Image
                    src={src}
                    alt={`Comunidade Foto ${idx + 1}`}
                    width={800}
                    height={800}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {!showAllComunidade && comunidadeImages.length > 3 && (
            <div className="mt-12 text-center">
              <button
                onClick={() => setShowAllComunidade(true)}
                className="inline-flex items-center gap-2 bg-[#F17B37] hover:bg-[#e06925] text-white px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(241,123,55,0.4)] hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" /> Ver Mais Fotos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 5. CALL TO ACTION & FOOTER */}
      <section id="footer" className="py-32 relative bg-gradient-to-t from-black to-[#0F1722] text-center px-6 md:snap-start min-h-screen flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Image src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG" alt="Mais Trilha Logo" width={800} height={800} className="h-32 w-32 rounded-full aspect-square object-cover object-center mx-auto mb-10 shadow-[0_0_30px_rgba(241,123,55,0.3)] border-4 border-[#F17B37]/50" />

          <h2 className="text-4xl md:text-5xl font-black mb-6 drop-shadow-xl">Pronto para a sua próxima aventura?</h2>
          <p className="text-xl text-gray-400 mb-12">Junte-se a nós e descubra do que você é capaz.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button onClick={() => router.push('/agenda')} className="w-full sm:w-auto bg-[#F17B37] hover:bg-[#e06925] text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_30px_rgba(241,123,55,0.4)] hover:shadow-[0_0_50px_rgba(241,123,55,0.6)] flex items-center justify-center gap-2 hover:scale-105">
              <Map className="h-5 w-5" /> Ver Agenda Completa
            </button>
            <a href="https://wa.me/5531998793939?text=Oi Nívea! Quero entrar no grupo VIP do Mais Trilha!" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 hover:scale-105 ring-1 ring-white/20">
              <Users className="h-5 w-5" /> Entrar no Grupo
            </a>
          </div>

          <motion.div className="mt-24 pt-10 border-t border-white/10 flex flex-col items-center gap-8 text-gray-400">

            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
              <div className="flex flex-col items-center md:items-start gap-2">
                <div className="flex items-center gap-3">
                  {/* AQUI ESTÁ O TRUQUE DE CSS: mix-blend-lighten com alto contraste tenta mesclar o fundo escuro do JPG com o fundo preto da página */}
                  <img
                    src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/logo/rodape.JPG"
                    alt="Montanhas Mais Trilha"
                    className="h-12 w-auto mix-blend-lighten rounded-lg"
                    style={{ filter: 'contrast(2) brightness(0.9)' }}
                  />
                  <span className="font-bold text-lg text-white">Mais Trilha Menos Estresse</span>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <a href="https://www.instagram.com/maistrilhamenosestresse/" target="_blank" className="hover:text-[#F17B37] transition-colors flex items-center gap-2 group">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram group-hover:scale-110 transition-transform"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                  Instagram
                </a>
                <a href="https://wa.me/5531998793939" target="_blank" className="hover:text-white transition-colors flex items-center gap-2 group">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-green-500 transition-colors group-hover:scale-110">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  Fale com a Nívea
                </a>
              </div>
            </div>

            {/* AVISO DE COPYRIGHT */}
            <div className="mt-8 text-center text-sm text-gray-500 opacity-80 flex flex-col items-center gap-2">
              <p>&copy; {new Date().getFullYear()} Mais Trilha Menos Estresse. Todos os direitos reservados.</p>
              <p><a href="/termos-de-uso" className="text-[#F17B37] hover:underline font-bold transition-colors">Clique aqui</a> para ler os Termos de Uso e Direitos Autorais.</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* FIXED BACK TO TOP BUTTON */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 md:w-14 md:h-14 bg-[#0F1722]/80 backdrop-blur-md flex items-center justify-center rounded-full border-2 border-white/20 hover:border-[#F17B37] hover:bg-[#F17B37] text-white transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(241,123,55,0.6)] group"
        title="Voltar ao Topo"
      >
        <ChevronDown className="w-6 h-6 md:w-8 md:h-8 rotate-180 group-hover:-translate-y-1 transition-transform" />
      </button>

      {/* SMART SCROLL DOWN BUTTON */}
      <motion.button
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        onClick={scrollToNextSection}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] hover:text-[#F17B37] transition-colors"
        title="Próxima Seção"
      >
        <ChevronDown className="w-10 h-10 md:w-12 md:h-12 opacity-80" />
      </motion.button>

      {/* LIGHTBOX DE FOTOS COMUNIDADE */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
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
                className="absolute left-4 md:left-8 text-white/70 hover:text-white hover:scale-110 bg-black/50 hover:bg-black/80 p-3 md:p-4 rounded-full transition-all z-50 cursor-pointer shadow-lg"
              >
                <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
              </button>
            )}

            {/* Próxima */}
            {lightboxIndex < comunidadeImages.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-4 md:right-8 text-white/70 hover:text-white hover:scale-110 bg-black/50 hover:bg-black/80 p-3 md:p-4 rounded-full transition-all z-50 cursor-pointer shadow-lg"
              >
                <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
              </button>
            )}

            {/* Imagem */}
            <motion.img
              key={lightboxIndex}
              initial={{ x: 300, opacity: 0, scale: 0.95 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: -300, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              src={comunidadeImages[lightboxIndex]}
              alt="Foto Expandida"
              className="w-full h-full object-contain max-w-6xl mx-auto p-4 cursor-default drop-shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Indicador */}
            <div className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-sm font-bold tracking-widest z-50 bg-black/40 py-1.5 w-24 mx-auto rounded-full backdrop-blur-md border border-white/10">
              {lightboxIndex + 1} / {comunidadeImages.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
