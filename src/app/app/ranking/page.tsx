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
    <div className="mt-app-page flex min-h-full flex-col">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-[2.25rem] bg-[linear-gradient(145deg,#061526,#0B2540)] px-5 pb-16 pt-[max(2.25rem,env(safe-area-inset-top))] shadow-lg sm:px-6">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Trophy className="w-32 h-32 text-white" /></div>
        <div className="relative z-10">
          <p className="mb-1 text-sm font-bold uppercase tracking-wider text-orange-200">Classificação geral</p>
          <h1 className="text-3xl font-black text-white mb-2">Desbrave o Topo!</h1>
          <p className="text-sm text-emerald-50/80">Faça trilhas, compre na loja e acumule pontos para subir de nível e ganhar prêmios.</p>
        </div>
      </div>

      <div className="relative z-20 -mt-8 flex-1 px-4 pb-10 sm:px-6">
        <div className="mt-surface mb-8 flex items-center justify-between rounded-3xl p-5">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase">Sua Posição</p>
            <h3 className="flex items-center gap-2 text-2xl font-black text-[#D96224]">
              {myPosition ? `${myPosition}º` : '-'} <Medal className="w-5 h-5 text-yellow-500" />
            </h3>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs font-bold uppercase">Seus Pontos</p>
            <h3 className="text-2xl font-black text-gray-800">{myPoints.toLocaleString('pt-BR')}</h3>
          </div>
        </div>

        <h3 className="font-black text-gray-800 text-lg mb-4">Aventureiros em destaque</h3>
        
        <div className="space-y-3">
          {ranking.map((user, index) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={user.id} 
              className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm ${user.isMe ? 'border-orange-200 bg-[#FFF0E6]' : 'border-gray-100 bg-white'}`}
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
                <h4 className={`font-bold text-sm ${user.isMe ? 'text-[#B84D18]' : 'text-gray-800'}`}>
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
