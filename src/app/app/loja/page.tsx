"use client";

import { useState, useEffect } from "react";
import { Search, ShoppingBag, Plus, Loader2, PackageOpen } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function PwaStore() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const supabase = createClient();
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('active', true)
        .gt('stock', 0);
      if (data) {
        setProducts(data);
      }
      setLoading(false);
    }
    loadProducts();
  }, []);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleBuy = (productId: string) => {
    router.push(`/app/loja/checkout?produtoId=${productId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white pt-12 pb-6 px-6 rounded-b-[2.5rem] shadow-sm relative z-10 border-b border-gray-100">
        <h1 className="text-2xl font-black text-gray-800 mb-4 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-blue-600" /> MaisTrilha Store
        </h1>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar equipamentos..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="px-6 py-8 flex-1 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-10">Nenhum equipamento encontrado.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map((product, index) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                key={product.id} 
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleBuy(product.id)}
              >
                <div className="w-full h-32 bg-gray-50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden group">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 512px) 50vw, 240px"
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <PackageOpen className="w-10 h-10 text-gray-300" />
                  )}
                  <button className="absolute bottom-2 right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 line-clamp-1">{product.category}</p>
                <h4 className="font-bold text-gray-800 text-xs leading-tight mb-2 flex-1">{product.name}</h4>
                <p className="text-blue-600 font-black text-sm">{formatCurrency(product.price)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
