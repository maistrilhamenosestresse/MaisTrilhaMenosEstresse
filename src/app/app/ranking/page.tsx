"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Star } from "lucide-react";

import { useEffect, useState } from "react";

export default function PwaRanking() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState<number>(0);

  useEffect(() => {
    async function loadRanking() {
      const response = await fetch('/api/app/ranking', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setRanking(data.ranking.map((entry: any) => ({ ...entry, id: entry.position, level: getLevel(entry.points) })));
      setMyPosition(data.myPosition);
      setMyPoints(data.myPoints);
    }
    loadRanking();
  }, []);

  const getLevel = (pts: number) => {
    if (pts > 4000) return "Lenda da Trilha";
    if (pts > 2000) return "Explorador";
    if (pts > 500) return "Aventureiro";
    return "Iniciante";
  };
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 pt-12 pb-16 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Trophy className="w-32 h-32 text-white" /></div>
        <div className="relative z-10">
          <p className="text-orange-100 font-bold uppercase tracking-wider text-sm mb-1">Ranking Geral</p>
          <h1 className="text-3xl font-black text-white mb-2">Desbrave o Topo!</h1>
          <p className="text-orange-50 text-sm">Faça trilhas, compre na loja e acumule pontos para subir de nível e ganhar prêmios.</p>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 flex-1 pb-10">
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100 mb-8 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase">Sua Posição</p>
            <h3 className="text-2xl font-black text-purple-600 flex items-center gap-2">
              {myPosition ? `${myPosition}º` : '-'} <Medal className="w-5 h-5 text-yellow-500" />
            </h3>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs font-bold uppercase">Seus Pontos</p>
            <h3 className="text-2xl font-black text-gray-800">{myPoints.toLocaleString('pt-BR')}</h3>
          </div>
        </div>

        <h3 className="font-black text-gray-800 text-lg mb-4">Top Aventureiros</h3>
        
        <div className="space-y-3">
          {ranking.map((user, index) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={user.id} 
              className={`p-4 rounded-2xl flex items-center gap-4 shadow-sm border ${user.isMe ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                index === 1 ? 'bg-gray-200 text-gray-700' :
                index === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-gray-50 text-gray-400'
              }`}>
                #{index + 1}
              </div>
              
              <div className="flex-1">
                <h4 className={`font-bold text-sm ${user.isMe ? 'text-purple-700' : 'text-gray-800'}`}>
                  {user.name} {user.isMe && '(Você)'}
                </h4>
                <p className="text-xs text-gray-500">{user.level}</p>
              </div>
              
              <div className="flex items-center gap-1 font-black text-gray-800">
                {user.points.toLocaleString('pt-BR')} <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
