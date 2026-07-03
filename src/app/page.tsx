/**
 * @file page.tsx
 * @description Página principal (Landing Page) da Mais Trilha Menos Estresse.
 *              Exibe o carrossel, depoimentos animados e integração com o sistema de checkout.
 * @module LandingPage
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import Image from "next/image";
import { ChevronDown, ArrowRight, TreePine, Map, Users, Heart } from "lucide-react";
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
    "/FotosEvideos/Nivea/WhatsApp Image 2026-06-26 at 10.39.37 (1).jpeg",

    "/FotosEvideos/Nivea/IMG_0521.JPG",

  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 4000); // 4 seconds per slide
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#0F1722] text-white min-h-screen overflow-x-hidden font-sans selection:bg-[#F17B37] selection:text-white">

      {/* NAVEGAÇÃO GLOBAL */}
      <Navigation />

      {/* 1. HERO SECTION */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-150 mix-blend-overlay"
        >
          <source src="/FotosEvideos/Nivea/video.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1722]/40 via-transparent to-[#0F1722] z-10" />
        <div className="absolute inset-0 bg-black/20 z-10" />

        <div className="relative z-20 text-center max-w-4xl px-6 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-6 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              Descubra uma <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F17B37] to-[#f9a03f]"></span> .
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className="text-lg md:text-2xl text-gray-200 font-medium max-w-2xl mb-12 leading-relaxed drop-shadow-lg"
          >
            Uma conexão indescritível com a natureza. Superação,  mudam a forma como você vê o mundo.
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

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 z-20 text-gray-400 drop-shadow-md"
        >
          <ChevronDown className="h-8 w-8 opacity-50" />
        </motion.div>
      </motion.section>

      {/* 2. A HISTÓRIA (NÍVEA E AS FUNDADORAS) */}
      <section className="py-24 md:py-40 px-6 relative z-20 bg-[#0F1722] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#F17B37]/5 via-[#0F1722]/80 to-[#0F1722] z-0" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-32 text-center"
          >
            <h2 className="text-[#F17B37] font-bold tracking-[0.3em] uppercase text-xs mb-6 drop-shadow-lg">A Nossa Essência</h2>
            <h3 className="text-5xl md:text-7xl font-black tracking-tight text-white drop-shadow-2xl">Como tudo começou</h3>
          </motion.div>

          {/* Intro Nivea */}
          <div className="flex flex-col md:flex-row gap-16 md:gap-24 items-center mb-40">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="flex-1 space-y-6"
            >
              <p className="text-2xl leading-relaxed text-gray-300 font-light">
                Me chamo <strong className="text-white font-medium">Nívea Maria</strong>... tenho 35 anos... e há 3 anos venho me aventurando e me desafiando no mundo do ecoturismo.
              </p>
              <p className="text-xl leading-relaxed text-gray-400 font-light">
                Sempre tive uma conexão muito forte com a natureza. Gosto do simples, do essencial. Na minha família, o hábito de acampar sempre esteve presente, mas foi o meu tio quem despertou em mim algo maior. Aquele universo me encantava.
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
              <Image src="/FotosEvideos/Nivea/WhatsApp Image 2026-06-26 at 10.28.20.jpeg" alt="Nívea na Cachoeira" width={800} height={800} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-1000 ease-out" />
              <div className="absolute bottom-8 left-8 z-20">
                <p className="font-black text-3xl text-white drop-shadow-lg">Nívea</p>
                <p className="text-[#F17B37] text-sm font-bold uppercase tracking-widest mt-1 drop-shadow-md">A Fundadora</p>
              </div>
            </motion.div>
          </div>

          {/* O Despertar (Bandeira) */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-center max-w-4xl mx-auto mb-40 relative"
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
              <Image src="/FotosEvideos//Nivea/IMG_3883.webp" alt="Nívea com a Bandeira" width={800} height={800} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            </motion.div>
          </motion.div>

          {/* As Fundadoras */}
          <div className="flex flex-col md:flex-row-reverse gap-16 md:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="flex-1 space-y-6"
            >
              <p className="text-2xl leading-relaxed text-gray-300 font-light">
                Decidi convidar meu tio para refazer uma trilha muito especial: a Cachoeira do Tabuleiro. Ele não pôde ir, então decidi ir sozinha. Ou pelo menos, essa era a ideia.
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
      <section className="py-40 relative bg-black overflow-hidden flex flex-col items-center justify-center min-h-[90vh]">
        <motion.div className="absolute inset-0 opacity-40" style={{ y: y3 }}>
          <Image src="/FotosEvideos/IMG_6341.webp" alt="Background Olhares" width={800} height={800} className="w-full h-[120%] object-cover blur-md scale-110" />
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
      <section className="py-32 px-6 bg-[#0F1722] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white/5 to-[#0F1722] z-0" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black mb-4 drop-shadow-xl">Nossa Comunidade</h2>
            <p className="text-xl text-gray-400">Momentos inesquecíveis vividos juntos.</p>
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_9320%20-%20Copia.JPG" alt="Comunidade" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </motion.div>

            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_0997.JPG" alt="Comunidade" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>

            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image 
                src="/FotosEvideos/PESSOAS%20ESPECIAIS/1647fade-8f9e-4eca-9cb9-bbf9b3fb26b6.jpg" 
                alt="Pessoas Especiais" 
                width={800}
                height={800}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000"
              />
            </motion.div>

            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/5e7df681-58d1-48ae-a6bc-1c9e57a3bcd0.jpg" alt="Grupo" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>

            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_8197.webp" alt="Grupo Expandido" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>

            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/PESSOAS%20ESPECIAIS/IMG_1809.webp" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>




            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_8162 - Copia.webp" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_9430 - Copia.JPG" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_5987.webp" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/Grupo/IMG_6178.webp" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/PESSOAS%20ESPECIAIS/59b3598c-060a-48c1-a372-894e60c16d63 Copy.JPG" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
            <motion.div className="relative rounded-2xl overflow-hidden shadow-xl group ring-1 ring-white/10 break-inside-avoid" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
              <Image src="/FotosEvideos/PESSOAS%20ESPECIAIS/IMG_5466.webp" alt="Grupo Mais" width={800} height={800} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION & FOOTER */}
      <section className="py-32 relative bg-gradient-to-t from-black to-[#0F1722] text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Image src="/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG" alt="Mais Trilha Logo" width={800} height={800} className="h-32 w-32 rounded-full aspect-square object-cover object-center mx-auto mb-10 shadow-[0_0_30px_rgba(241,123,55,0.3)] border-4 border-[#F17B37]/50" />

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

          <motion.div className="mt-24 pt-10 border-t border-white/10 flex flex-col items-center gap-6 text-gray-400">
            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col items-center md:items-start gap-2">
                <div className="flex items-center gap-3">
                  {/* AQUI ESTÁ O TRUQUE DE CSS: mix-blend-screen com contraste tira o fundo da JPG! */}
                  <img 
                    src="/FotosEvideos/logo/rodape.JPG" 
                    alt="Montanhas Mais Trilha" 
                    className="h-12 w-auto mix-blend-screen"
                    style={{ filter: 'contrast(1.8) brightness(0.8)' }} 
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
            
            {/* DIREITOS AUTORAIS */}
            <div className="mt-12 text-center text-sm text-gray-500 opacity-60 flex flex-col items-center gap-4">
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-600 hover:border-[#F17B37] hover:text-[#F17B37] transition-all hover:scale-110 group mb-4"
                title="Voltar ao Topo"
              >
                <ChevronDown className="w-6 h-6 rotate-180 group-hover:-translate-y-1 transition-transform" />
              </button>
              <p>© {new Date().getFullYear()} Todos os direitos reservados a Mais Trilha Menos Estresse.</p>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
