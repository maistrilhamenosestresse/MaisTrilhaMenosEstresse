"use client";

import { useState, useEffect } from "react";
import { Trophy, Star, Medal, Users, ArrowUpRight, Search, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function GamificacaoDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPoints: 0, engagedUsers: 0, generatedCashback: 0 });

  useEffect(() => {
    const fetchRanking = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, pontos, cashback_saldo')
        .order('pontos', { ascending: false, nullsFirst: false });

      if (data) {
        let engaged = 0;
        let tPoints = 0;
        let tCashback = 0;
        
        const mapped = data.map((c: any) => {
          if (c.pontos > 0) engaged++;
          tPoints += (c.pontos || 0);
          // If the user has used points, generatedCashback would be total points - current saldo, assuming 1 point = 1 BRL
          const usedCashback = Math.max(0, (c.pontos || 0) - (c.cashback_saldo || 0));
          tCashback += usedCashback;

          let level = "Iniciante";
          if (c.pontos >= 3000) level = "Lenda da Trilha";
          else if (c.pontos >= 1000) level = "Explorador";
          else if (c.pontos >= 300) level = "Aventureiro";

          return {
            id: c.id,
            name: c.full_name || "Sem Nome",
            points: c.pontos || 0,
            level: level,
          };
        });

        setStats({ totalPoints: tPoints, engagedUsers: engaged, generatedCashback: tCashback });
        setRanking(mapped);
      }
      setLoading(false);
    };
    fetchRanking();
  }, []);

  const filteredRanking = ranking.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header e KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Trophy className="w-16 h-16" /></div>
          <p className="text-purple-100 font-bold text-sm uppercase tracking-wider mb-1">Pontos Distribuídos</p>
          <h3 className="text-4xl font-black mb-2">{stats.totalPoints}</h3>
          <p className="text-xs text-purple-200">+2.4k este mês</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users className="w-16 h-16 text-blue-500" /></div>
          <p className="text-gray-400 font-bold text-sm uppercase tracking-wider mb-1">Usuários Engajados</p>
          <h3 className="text-4xl font-black text-gray-800 mb-2">{stats.engagedUsers}</h3>
          <p className="text-xs text-green-500 font-bold flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> 12% vs último mês</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Star className="w-16 h-16 text-yellow-500" /></div>
          <p className="text-gray-400 font-bold text-sm uppercase tracking-wider mb-1">Cashback Gerado</p>
          <h3 className="text-4xl font-black text-gray-800 mb-2">R$ {stats.generatedCashback.toFixed(2)}</h3>
          <p className="text-xs text-gray-400 font-bold">Resgatados em descontos</p>
        </div>
      </div>

      {/* Main Ranking Area */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Medal className="w-7 h-7 text-yellow-500" /> Ranking Geral
            </h2>
            <p className="text-gray-500 text-sm mt-1">Estimule a competição e fidelize seus clientes.</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>
            <button className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-xl shadow-md transition-colors shrink-0">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-4 font-semibold pl-4">Posição</th>
                <th className="pb-4 font-semibold">Cliente</th>
                <th className="pb-4 font-semibold">Nível</th>
                <th className="pb-4 font-semibold">Trilhas</th>
                <th className="pb-4 font-semibold text-right pr-4">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.map((client, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={client.id} 
                  className="border-b border-gray-50 hover:bg-purple-50/50 transition-colors group"
                >
                  <td className="py-4 pl-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                      ${index === 0 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300' : 
                        index === 1 ? 'bg-gray-100 text-gray-600 border-2 border-gray-300' : 
                        index === 2 ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' : 
                        'bg-gray-50 text-gray-400'}
                    `}>
                      #{index + 1}
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="font-bold text-gray-800">{client.name}</p>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${client.level === 'Lenda da Trilha' ? 'bg-purple-100 text-purple-700' :
                        client.level === 'Explorador' ? 'bg-blue-100 text-blue-700' :
                        client.level === 'Aventureiro' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'}
                    `}>
                      {client.level}
                    </span>
                  </td>
                  <td className="py-4 text-gray-500 font-medium">
                    -
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-black text-lg text-purple-600">{client.points}</span>
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
