"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, Plus, History, Star, ChevronRight, Gift, ShoppingBag, PackageOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type FeaturedProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
};

export default function PwaDashboard() {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [userRank, setUserRank] = useState("Iniciante");
  const [clientData, setClientData] = useState<any>(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const [{ data: { user } }, { data: products }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("produtos")
          .select("id, name, category, price, image")
          .eq("active", true)
          .gt("stock", 0)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      setFeaturedProducts((products || []) as FeaturedProduct[]);
      setProductsLoading(false);
      
      if (user?.email) {
        const { data: client } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user.email)
          .single();
            
        if (client) {
          setClientData(client);
          const pts = client.pontos || 0;
          if (pts <= 100) setUserRank("Iniciante");
          else if (pts <= 500) setUserRank("Explorador");
          else setUserRank("Lenda da Trilha");

          if (client.full_name) {
            setUserName(client.full_name);
            const parts = client.full_name.split(' ');
            const initials = parts.length > 1
              ? `${parts[0][0]}${parts[parts.length-1][0]}`
              : parts[0].substring(0, 2);
            setUserInitials(initials.toUpperCase());
          }
        }
      }
    };
    fetchUser();
  }, []);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleRecarregar = () => {
    setIsAnimating(true);
    setTimeout(() => {
      router.push('/app/recarregar');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Premium (Estilo Banco Digital) */}
      <div className="bg-gradient-to-b from-purple-700 to-purple-900 pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-500 opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-500 opacity-20 blur-2xl" />

        <div className="flex justify-between items-center mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full border border-white/30 flex items-center justify-center overflow-hidden shadow-inner relative">
              {clientData?.photo_url && !profileImageFailed ? (
                <Image
                  src={clientData.photo_url} 
                  alt={`Foto de ${userName || "aventureiro"}`}
                  fill
                  sizes="48px"
                  className="object-cover"
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <span className="text-white font-black text-xl">{userInitials}</span>
              )}
            </div>
            <div>
              <p className="text-purple-200 text-xs font-medium">Olá, {userRank}</p>
              <h1 className="text-white font-bold text-lg">{userName || "Aventureiro"}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/app/ranking')}
            aria-label="Ver meu ranking"
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-2.5 rounded-full border border-white/20 transition-colors"
          >
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </button>
        </div>

        <div className="relative z-10">
          <p className="text-purple-200 text-sm font-medium mb-1 flex items-center gap-2">
            💳 Saldo Cashback <span className="bg-purple-500/50 px-2 py-0.5 rounded text-[10px] font-bold">Dinheiro Real</span>
          </p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-black text-white">{formatCurrency(clientData?.cashback_saldo || 0)}</h2>
            <button 
              onClick={handleRecarregar}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-purple-300 text-xs mt-1">
            ⭐ {clientData?.pontos || 0} pontos de fidelidade ≈ {formatCurrency((clientData?.pontos || 0) / 100)} de desconto
          </p>
        </div>
      </div>

      {/* Smooth Expansion Overlay */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div 
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 150, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }} // Mais suave, dá tempo de ver a bola crescer
            className="fixed top-[140px] right-[40px] w-8 h-8 bg-purple-600 rounded-full z-[100] origin-center"
          />
        )}
      </AnimatePresence>

      {/* Main Action Buttons */}
      <div className="px-6 -mt-12 relative z-20">
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100 flex justify-between gap-2">
          <button onClick={() => router.push('/app/loja')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center text-purple-600 transition-colors">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Loja</span>
          </button>
          <button onClick={handleRecarregar} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Recarregar</span>
          </button>
          <button onClick={() => router.push('/app/beneficios')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center text-orange-600 transition-colors">
              <Gift className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Benefícios</span>
          </button>
          <button onClick={() => router.push('/app/extratos')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
              <History className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Extrato</span>
          </button>
        </div>
      </div>

      {/* Seção Loja / Benefícios */}
      <div className="px-6 mt-8 space-y-6 flex-1 pb-10">
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-black text-gray-800">MaisTrilha Store</h3>
            <Link href="/app/loja" className="text-purple-600 text-xs font-bold flex items-center">Ver tudo <ChevronRight className="w-3 h-3" /></Link>
          </div>
          
          {productsLoading ? (
            <div className="flex gap-4 overflow-hidden pb-4" aria-label="Carregando produtos">
              {[0, 1].map((item) => (
                <div key={item} className="min-w-[140px] h-48 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
              {featuredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => router.push(`/app/loja/checkout?produtoId=${product.id}`)}
                  className="min-w-[140px] text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 snap-start shrink-0 hover:border-purple-200 transition-colors"
                >
                  <div className="w-full h-24 bg-gray-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="140px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <PackageOpen className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1 line-clamp-1">{product.category}</p>
                  <h4 className="font-bold text-gray-800 text-sm leading-tight mb-2 line-clamp-2">{product.name}</h4>
                  <p className="text-purple-600 font-black">{formatCurrency(product.price)}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <PackageOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">Novidades em breve</p>
              <p className="text-xs text-gray-500 mt-1">A loja ainda não possui produtos disponíveis.</p>
            </div>
          )}
        </div>

        {/* Últimas Transações */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-black text-gray-800">Sua Movimentação</h3>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <History className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-gray-800 text-sm mb-1">Acompanhe seus gastos</h4>
            <p className="text-xs text-gray-500 mb-4 px-4">Veja seu extrato de compras, uso de cashback e recargas de saldo da sua carteira.</p>
            <button onClick={() => router.push('/app/extratos')} className="bg-purple-100 text-purple-700 font-bold text-sm px-6 py-2.5 rounded-full hover:bg-purple-200 transition-colors">
              Acessar Meu Extrato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
