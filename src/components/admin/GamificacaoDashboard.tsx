"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Medal, Search, Star, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { getAdventureProgress } from "@/lib/gamification";

type RankingClient = {
  id: string;
  name: string;
  points: number;
  experience: number;
  level: string;
};

export default function GamificacaoDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [ranking, setRanking] = useState<RankingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPoints: 0, totalExperience: 0, engagedUsers: 0 });

  useEffect(() => {
    const fetchRanking = async () => {
      const { data } = await createClient()
        .from("clients")
        .select("id, full_name, pontos, experiencia")
        .order("experiencia", { ascending: false, nullsFirst: false });

      const clients = data || [];
      let totalPoints = 0;
      let totalExperience = 0;
      let engagedUsers = 0;
      const mapped = clients.map((client: any) => {
        const points = Number(client.pontos || 0);
        const experience = Number(client.experiencia || 0);
        totalPoints += points;
        totalExperience += experience;
        if (points > 0 || experience > 0) engagedUsers += 1;
        return {
          id: client.id,
          name: client.full_name || "Sem nome",
          points,
          experience,
          level: getAdventureProgress(experience).current.name,
        };
      });

      setStats({ totalPoints, totalExperience, engagedUsers });
      setRanking(mapped);
      setLoading(false);
    };
    void fetchRanking();
  }, []);

  const filteredRanking = useMemo(() => ranking.filter((client) =>
    client.name.toLocaleLowerCase("pt-BR").includes(searchTerm.toLocaleLowerCase("pt-BR")),
  ), [ranking, searchTerm]);

  if (loading) {
    return <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#0B2540]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          dark
          icon={Trophy}
          label="XP acumulado"
          value={stats.totalExperience.toLocaleString("pt-BR")}
          help="Experiência permanente gerada pelas jornadas"
        />
        <MetricCard
          icon={Star}
          label="Pontos disponíveis"
          value={stats.totalPoints.toLocaleString("pt-BR")}
          help="Saldo que os clientes podem usar em descontos"
        />
        <MetricCard
          icon={Users}
          label="Clientes engajados"
          value={stats.engagedUsers.toLocaleString("pt-BR")}
          help="Clientes com pontos ou experiência"
        />
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-gray-800">
              <Medal className="h-7 w-7 text-yellow-500" /> Ranking por experiência
            </h2>
            <p className="mt-1 text-sm text-gray-500">O nível não diminui quando o cliente usa seus pontos.</p>
          </div>
          <label className="relative block w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <span className="sr-only">Buscar cliente</span>
            <input
              type="search"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-[#0B2540] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                <th className="pb-4 pl-4 font-semibold">Posição</th>
                <th className="pb-4 font-semibold">Cliente</th>
                <th className="pb-4 font-semibold">Nível</th>
                <th className="pb-4 text-right font-semibold">XP</th>
                <th className="pb-4 pr-4 text-right font-semibold">Pontos disponíveis</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.map((client, index) => (
                <motion.tr
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  key={client.id}
                  className="border-b border-gray-50 transition-colors hover:bg-blue-50/50"
                >
                  <td className="py-4 pl-4"><PositionBadge position={index + 1} /></td>
                  <td className="py-4 font-bold text-gray-800">{client.name}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-[#E7EEF6] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0B2540]">{client.level}</span>
                  </td>
                  <td className="py-4 text-right font-black text-[#D96224]">{client.experience.toLocaleString("pt-BR")}</td>
                  <td className="py-4 pr-4 text-right font-bold text-gray-700">{client.points.toLocaleString("pt-BR")}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ dark = false, icon: Icon, label, value, help }: {
  dark?: boolean;
  icon: typeof Trophy;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm ${dark ? "border-[#173E63] bg-[linear-gradient(145deg,#061526,#12385E)] text-white" : "border-gray-100 bg-white text-gray-800"}`}>
      <Icon className={`absolute right-4 top-4 h-16 w-16 opacity-10 ${dark ? "text-white" : "text-[#0B2540]"}`} />
      <p className={`text-sm font-bold uppercase tracking-wider ${dark ? "text-blue-100" : "text-gray-400"}`}>{label}</p>
      <p className="mt-1 text-4xl font-black">{value}</p>
      <p className={`mt-2 text-xs ${dark ? "text-blue-100/70" : "text-gray-500"}`}>{help}</p>
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  const style = position === 1
    ? "border-yellow-300 bg-yellow-100 text-yellow-700"
    : position === 2
      ? "border-gray-300 bg-gray-100 text-gray-600"
      : position === 3
        ? "border-orange-300 bg-orange-100 text-orange-700"
        : "border-transparent bg-gray-50 text-gray-400";
  return <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-black ${style}`}>#{position}</div>;
}
