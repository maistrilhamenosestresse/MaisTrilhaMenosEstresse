/**
 * @file Navigation.tsx
 * @description Componente global de barra de navegação (Navbar). 
 *              Inclui responsividade, controle do carrinho via Zustand e links âncora.
 * @module Navigation
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useEffect } from "react";

/**
 * @function Navigation
 * @description Renderiza a Navbar superior, monitorando o estado do carrinho de compras e o menu mobile.
 * @returns {JSX.Element} Barra de navegação fixa com menu sanduíche no mobile.
 */
export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { getTotalQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const cartQuantity = mounted ? getTotalQuantity() : 0;

  // Hide the navigation on admin or specific pages if needed.
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-12 py-3 md:py-4 bg-transparent md:bg-gradient-to-b md:from-[#0F1722]/80 md:to-transparent md:backdrop-blur-sm">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/">
            <Image
              src="/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG" 
              alt="Mais Trilha Logo"
              width={80}
              height={80}
              className="h-12 w-12 md:h-20 md:w-20 rounded-full aspect-square object-cover object-center shadow-[0_0_15px_rgba(241,123,55,0.4)] border-2 md:border-4 border-[#F17B37]/30 transition-transform hover:scale-105 cursor-pointer" 
            />
          </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-8">
          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className={`text-sm font-bold transition-colors hover:text-[#F17B37] ${pathname === '/' ? 'text-[#F17B37]' : 'text-gray-300'}`}
            >
              Início
            </Link>
            <Link 
              href="/sobre" 
              className={`text-sm font-bold transition-colors hover:text-[#F17B37] ${pathname === '/sobre' ? 'text-[#F17B37]' : 'text-gray-300'}`}
            >
              Sobre Nós
            </Link>
            <Link 
              href="/avaliacoes" 
              className={`text-sm font-bold transition-colors hover:text-[#F17B37] ${pathname === '/avaliacoes' ? 'text-[#F17B37]' : 'text-gray-300'}`}
            >
              Avaliações
            </Link>
            <Link 
              href="/contato" 
              className={`text-sm font-bold transition-colors hover:text-[#F17B37] ${pathname === '/contato' ? 'text-[#F17B37]' : 'text-gray-300'}`}
            >
              Fale Conosco
            </Link>
          </div>

          <button
            onClick={() => router.push('/agenda')}
            className="hidden md:block bg-[#F17B37] hover:bg-[#e06925] text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all hover:scale-105 shadow-[0_0_20px_rgba(241,123,55,0.3)] whitespace-nowrap"
          >
            Ver Agenda Completa
          </button>

          {/* Cart Icon & Comprar Button */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => router.push('/carrinho')}
              className="relative p-2 text-white hover:text-[#F17B37] transition-colors bg-white/5 md:bg-transparent rounded-xl md:rounded-none border border-white/10 md:border-transparent"
              aria-label="Carrinho de Compras"
            >
              <ShoppingCart className="w-6 h-6 md:w-6 md:h-6" />
              {cartQuantity > 0 && (
                <span className="absolute top-0 right-0 bg-[#25D366] text-white text-[10px] font-bold w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center translate-x-1 -translate-y-1 shadow-md">
                  {cartQuantity}
                </span>
              )}
            </button>

            <button
              onClick={() => router.push('/agenda')}
              className="bg-[#F17B37] hover:bg-[#e06925] text-white px-5 py-2 md:px-6 md:py-2.5 rounded-full font-bold text-sm transition-all hover:scale-105 shadow-[0_0_15px_rgba(241,123,55,0.4)]"
            >
              Comprar
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden flex items-center justify-center text-white bg-[#F17B37] hover:bg-[#e06925] p-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(241,123,55,0.4)]"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#0F1722]/95 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            <button 
              className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>

            <div className="flex flex-col items-center gap-8 text-2xl font-black">
              <Link 
                href="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`transition-colors hover:text-[#F17B37] ${pathname === '/' ? 'text-[#F17B37]' : 'text-white'}`}
              >
                Início
              </Link>
              <Link 
                href="/sobre" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`transition-colors hover:text-[#F17B37] ${pathname === '/sobre' ? 'text-[#F17B37]' : 'text-white'}`}
              >
                Sobre Nós
              </Link>
              <Link 
                href="/avaliacoes" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`transition-colors hover:text-[#F17B37] ${pathname === '/avaliacoes' ? 'text-[#F17B37]' : 'text-white'}`}
              >
                Avaliações
              </Link>
              <Link 
                href="/contato" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`transition-colors hover:text-[#F17B37] ${pathname === '/contato' ? 'text-[#F17B37]' : 'text-white'}`}
              >
                Fale Conosco
              </Link>
              
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push('/agenda');
                }}
                className="mt-4 bg-[#F17B37] text-white px-8 py-3 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(241,123,55,0.4)]"
              >
                Ver Agenda Completa
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
