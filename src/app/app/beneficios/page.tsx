"use client";

import { ChevronLeft, Gift, Star, Award, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PwaBeneficios() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-b from-orange-500 to-orange-600 pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-md relative">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/20 hover:bg-white/30 transition-colors rounded-full flex items-center justify-center text-white mb-6 backdrop-blur-md">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Gift className="w-6 h-6" /> Seus Benefícios
        </h1>
        <p className="text-orange-100 text-sm mt-2 font-medium">Explore as vantagens exclusivas do MaisTrilha.</p>
      </div>

      <div className="px-6 py-8 flex-1 space-y-4 pb-20">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600"><Star className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Programa de Cashback</h3>
            <p className="text-xs text-gray-500 mt-1">Ganhe saldo de volta ao realizar recargas e logo poderá comprar equipamentos na nossa loja.</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="bg-purple-100 p-3 rounded-2xl text-purple-600"><Award className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Ranking de Aventureiros</h3>
            <p className="text-xs text-gray-500 mt-1">Acumule pontos em cada compra de trilha e suba de nível no App (Iniciante, Explorador, Lenda).</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-start gap-4 opacity-70">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-600"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Descontos em Trilhas (Em Breve)</h3>
            <p className="text-xs text-gray-500 mt-1">Utilize seus pontos e cashback acumulado para abater o valor de novas aventuras direto pelo App.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
