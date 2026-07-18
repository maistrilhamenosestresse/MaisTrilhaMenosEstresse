"use client";

import { ChevronLeft, Gift, Star, Award, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PwaBeneficios() {
  const router = useRouter();

  return (
    <div className="mt-app-page flex min-h-full flex-col">
      <div className="relative rounded-b-[2.25rem] bg-[linear-gradient(145deg,#061526,#0B2540)] px-5 pb-8 pt-[max(2.25rem,env(safe-area-inset-top))] shadow-md sm:px-6">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/20 hover:bg-white/30 transition-colors rounded-full flex items-center justify-center text-white mb-6 backdrop-blur-md">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Gift className="w-6 h-6" /> Seus Benefícios
        </h1>
        <p className="mt-2 text-sm font-medium text-emerald-50/80">Explore as vantagens exclusivas do MaisTrilha.</p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-8 pb-20 sm:px-6">
        <div className="mt-surface flex items-start gap-4 rounded-3xl p-5">
          <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600"><Star className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Programa de saldo de volta</h3>
            <p className="text-xs text-gray-500 mt-1">Ganhe saldo de volta ao realizar recargas e logo poderá comprar equipamentos na nossa loja.</p>
          </div>
        </div>
        <div className="mt-surface flex items-start gap-4 rounded-3xl p-5">
          <div className="rounded-2xl bg-[#E7EEF6] p-3 text-[#0B2540]"><Award className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Classificação de aventureiros</h3>
            <p className="text-xs text-gray-500 mt-1">Acumule pontos em cada compra de trilha e suba de nível no aplicativo: Iniciante, Explorador e Lenda.</p>
          </div>
        </div>
        <div className="mt-surface flex items-start gap-4 rounded-3xl p-5 opacity-70">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-600"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-gray-800">Descontos em Trilhas (Em Breve)</h3>
            <p className="text-xs text-gray-500 mt-1">Utilize seus pontos e saldo acumulado para reduzir o valor de novas aventuras diretamente pelo aplicativo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
