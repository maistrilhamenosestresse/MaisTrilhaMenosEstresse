"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, Plus, History, Star, ChevronRight, Gift, ShoppingBag, PackageOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PwaEngagementCard } from "@/components/app/PwaEngagementCard";
import { getOfflineData, navigateAppOfflineFirst, saveOfflineData } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";
import { getAdventureProgress, pointsToDiscount } from "@/lib/gamification";

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
  const [refreshKey, setRefreshKey] = useState(0);
  const online = useNetworkStatus();

  const applyClient = (client: any) => {
    const progress = getAdventureProgress(Number(client?.experiencia || 0));
    setUserRank(progress.current.name);
    if (client?.full_name) {
      setUserName(client.full_name);
      const parts = client.full_name.split(" ");
      setUserInitials((parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].substring(0, 2)).toUpperCase());
    }
  };

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshKey((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setProductsLoading(false);
        return;
      }

      const cached = getOfflineData<{ client: any; products: FeaturedProduct[] }>(user.id, "dashboard");
      if (cached) {
        setClientData(cached.data.client);
        setFeaturedProducts(cached.data.products);
        applyClient(cached.data.client);
      }

      if (!navigator.onLine) {
        setProductsLoading(false);
        return;
      }

      try {
        const [{ data: products }, profileResponse] = await Promise.all([
          supabase.from("produtos").select("id, name, category, price, image").eq("active", true).gt("stock", 0).order("created_at", { ascending: false }).limit(4),
          fetch("/api/clients/me", { cache: "no-store" }),
        ]);
        const profileResult = await profileResponse.json().catch(() => ({}));
        const client = profileResponse.ok ? profileResult.client : cached?.data.client;
        const normalizedProducts = (products || []) as FeaturedProduct[];
        setFeaturedProducts(normalizedProducts);
            
        if (client) {
          setClientData(client);
          applyClient(client);
          saveOfflineData(user.id, "dashboard", { client, products: normalizedProducts });
        }
      } catch (error) {
        console.warn("Painel usando a última cópia salva no aparelho.", error);
      } finally {
        setProductsLoading(false);
      }
    };
    void fetchUser();
  }, [online, refreshKey]);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const adventure = getAdventureProgress(Number(clientData?.experiencia || 0));

  const handleRecarregar = () => {
    setIsAnimating(true);
    setTimeout(() => {
      navigateAppOfflineFirst(router, '/app/recarregar');
    }, 1200);
  };

  return (
    <div className="mt-app-page flex min-h-full flex-col">
      {/* Header Premium (Estilo Banco Digital) */}
      <div className="relative overflow-hidden rounded-b-[2.25rem] bg-[linear-gradient(145deg,#061526_0%,#0B2540_72%,#12385E_100%)] px-5 pb-24 pt-[max(2.25rem,env(safe-area-inset-top))] shadow-[0_20px_45px_rgba(5,24,43,0.25)] sm:px-7">
        {/* Abstract background shapes */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#F17B37]/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-300/10 blur-2xl" />

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
              <p className="text-blue-100/75 text-xs font-semibold">Olá, {userRank}</p>
              <h1 className="text-white font-bold text-lg">{userName || "Aventureiro"}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateAppOfflineFirst(router, '/app/ranking')}
            aria-label="Ver meu ranking"
            className="rounded-full border border-white/15 bg-white/10 p-2.5 backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </button>
        </div>

        <div className="relative z-10">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-100/80">
            💳 Saldo disponível <span className="rounded-full bg-[#F17B37]/20 px-2 py-0.5 text-[10px] font-extrabold text-orange-100">Benefício</span>
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
          <p className="mt-1 text-xs text-blue-100/70">
            ⭐ {clientData?.pontos || 0} pontos · até {formatCurrency(pointsToDiscount(clientData?.pontos || 0))} de desconto
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold">
              <span className="text-orange-100">{adventure.experience.toLocaleString("pt-BR")} XP de jornada</span>
              <span className="text-blue-100/65">
                {adventure.next ? `${adventure.remaining.toLocaleString("pt-BR")} XP para ${adventure.next.name}` : "Nível máximo"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${adventure.progress}%` }}
                className="h-full rounded-full bg-[linear-gradient(90deg,#F17B37,#F9C784)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Smooth Expansion Overlay */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div 
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 150, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }} // Mais suave, dá tempo de ver a bola crescer
            className="fixed right-[40px] top-[140px] z-[100] h-8 w-8 origin-center rounded-full bg-[#F17B37]"
          />
        )}
      </AnimatePresence>

      {/* Main Action Buttons */}
      <div className="relative z-20 -mt-12 px-4 sm:px-6">
        <div className="mt-surface flex justify-between gap-1 rounded-[1.75rem] p-4">
          <button onClick={() => navigateAppOfflineFirst(router, '/app/loja')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0E6] text-[#D96224] transition-colors group-hover:bg-orange-100">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Loja</span>
          </button>
          <button onClick={handleRecarregar} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7EEF6] text-[#0B2540] transition-colors group-hover:bg-blue-100">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Recarregar</span>
          </button>
          <button onClick={() => navigateAppOfflineFirst(router, '/app/beneficios')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 transition-colors group-hover:bg-amber-100">
              <Gift className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Benefícios</span>
          </button>
          <button onClick={() => navigateAppOfflineFirst(router, '/app/extratos')} className="flex flex-col items-center justify-center gap-2 flex-1 group">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
              <History className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-700">Extrato</span>
          </button>
        </div>
      </div>

      {/* Seção Loja / Benefícios */}
      <div className="mt-8 flex-1 space-y-7 px-4 pb-8 sm:px-6">
        <PwaEngagementCard compact />

        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="mt-eyebrow">Equipamentos</p>
              <h3 className="text-lg font-black text-[#071829]">Loja MaisTrilha</h3>
            </div>
            <Link href="/app/loja" className="flex items-center text-xs font-extrabold text-[#D96224]">Ver tudo <ChevronRight className="w-3 h-3" /></Link>
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
                  onClick={() => navigateAppOfflineFirst(router, `/app/loja/checkout?produtoId=${product.id}`)}
                  className="mt-surface min-w-[148px] shrink-0 snap-start rounded-2xl p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-200"
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
                  <p className="font-black text-[#D96224]">{formatCurrency(product.price)}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-surface rounded-2xl p-5 text-center">
              <PackageOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">Novidades em breve</p>
              <p className="text-xs text-gray-500 mt-1">A loja ainda não possui produtos disponíveis.</p>
            </div>
          )}
        </div>

        {/* Últimas Transações */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="mt-eyebrow">Carteira</p>
              <h3 className="text-lg font-black text-[#071829]">Sua movimentação</h3>
            </div>
          </div>
          <div className="mt-surface flex flex-col items-center rounded-[1.75rem] p-6 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <History className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-gray-800 text-sm mb-1">Acompanhe seus gastos</h4>
            <p className="text-xs text-gray-500 mb-4 px-4">Veja seu extrato de compras, uso de saldo e recargas da sua carteira.</p>
            <button onClick={() => navigateAppOfflineFirst(router, '/app/extratos')} className="rounded-full bg-[#0B2540] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#061B30]">
              Acessar Meu Extrato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
