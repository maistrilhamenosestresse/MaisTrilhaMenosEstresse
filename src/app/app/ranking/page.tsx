"use client";

import { motion } from "framer-motion";
import { Medal, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

type RankingEntry = {
  id: number;
  position: number;
  name: string;
  points: number;
  experience: number;
  level: string;
  isMe: boolean;
};

export default function PwaRanking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [myExperience, setMyExperience] = useState(0);
  const [myLevel, setMyLevel] = useState("Primeiros Passos");
  const [refreshKey, setRefreshKey] = useState(0);

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
    async function loadRanking() {
      const response = await fetch(`/api/app/ranking?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setRanking((data.ranking || []).map((entry: Omit<RankingEntry, "id">) => ({ ...entry, id: entry.position })));
      setMyPosition(data.myPosition);
      setMyPoints(Number(data.myPoints || 0));
      setMyExperience(Number(data.myExperience || 0));
      setMyLevel(data.myLevel || "Primeiros Passos");
    }
    void loadRanking();
  }, [refreshKey]);

  return (
    <div className="mt-app-page flex min-h-full flex-col">
      <div className="relative overflow-hidden rounded-b-[2.25rem] bg-[linear-gradient(145deg,#061526,#0B2540)] px-5 pb-16 pt-[max(2.25rem,env(safe-area-inset-top))] shadow-lg sm:px-6">
        <div className="absolute right-0 top-0 p-4 opacity-20"><Trophy className="h-32 w-32 text-white" /></div>
        <div className="relative z-10">
          <p className="mb-1 text-sm font-bold uppercase tracking-wider text-orange-200">Classificação geral</p>
          <h1 className="mb-2 text-3xl font-black text-white">Desbrave o topo!</h1>
          <p className="text-sm text-blue-50/80">Ganhe XP com compras e expedições. Usar pontos em descontos não reduz seu nível.</p>
        </div>
      </div>

      <div className="relative z-20 -mt-8 flex-1 px-4 pb-10 sm:px-6">
        <div className="mt-surface mb-8 flex items-center justify-between rounded-3xl p-5">
          <div>
            <p className="text-xs font-bold uppercase text-gray-400">Sua posição</p>
            <h3 className="flex items-center gap-2 text-2xl font-black text-[#D96224]">
              {myPosition ? `${myPosition}º` : "-"} <Medal className="h-5 w-5 text-yellow-500" />
            </h3>
            <p className="mt-1 text-xs font-bold text-[#0B2540]">{myLevel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-gray-400">Sua jornada</p>
            <p className="text-xl font-black text-[#0B2540]">{myExperience.toLocaleString("pt-BR")} XP</p>
            <p className="mt-1 text-xs text-gray-500">{myPoints.toLocaleString("pt-BR")} pontos disponíveis</p>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-black text-gray-800">Aventureiros em destaque</h2>
        <div className="space-y-3">
          {ranking.map((user, index) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              key={user.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm ${user.isMe ? "border-orange-200 bg-[#FFF0E6]" : "border-gray-100 bg-white"}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${
                index === 0 ? "bg-yellow-100 text-yellow-700" :
                index === 1 ? "bg-gray-200 text-gray-700" :
                index === 2 ? "bg-orange-100 text-orange-700" :
                "bg-gray-50 text-gray-400"
              }`}>
                #{index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`truncate text-sm font-bold ${user.isMe ? "text-[#B84D18]" : "text-gray-800"}`}>
                  {user.name} {user.isMe && "(Você)"}
                </h3>
                <p className="text-xs text-gray-500">{user.level}</p>
                <p className="mt-0.5 text-[10px] text-gray-400">{user.points.toLocaleString("pt-BR")} pontos para usar</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 font-black text-gray-800">
                  {user.experience.toLocaleString("pt-BR")} <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">XP</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
