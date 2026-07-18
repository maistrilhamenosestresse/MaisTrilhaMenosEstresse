"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Battery,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

type Operation = {
  id: string;
  name: string;
  status: string;
  agendas?: { title?: string; date?: string };
};

type Member = {
  id: string;
  display_name: string;
  role: string;
  last_status: string;
  battery_percent?: number | null;
  last_seen_at?: string | null;
};

type Location = {
  member_id: string;
  latitude: number;
  longitude: number;
  client_created_at: string;
};

const statusLabels: Record<string, string> = {
  planned: "Planejada",
  check_in: "Check-in",
  active: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const memberLabels: Record<string, string> = {
  ok: "Tudo bem",
  rest_requested: "Quer descansar",
  help_requested: "Pediu ajuda",
  sos: "SOS",
  off_route: "Fora da rota",
  disconnected: "Sem contato",
  finished: "Concluiu",
};

export default function AdminOperationsPage() {
  const router = useRouter();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOperations = useCallback(async () => {
    const response = await fetch("/api/operations", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao carregar operações");
    setOperations(payload.operations || []);
    setSelectedId((current) => current || payload.operations?.[0]?.id || "");
  }, []);

  const loadDetails = useCallback(async () => {
    if (!selectedId) return;
    const response = await fetch(`/api/operations/${selectedId}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao carregar a central");
    setDetails(payload);
  }, [selectedId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadOperations();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Falha ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOperations]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetails();
    const timer = window.setInterval(() => void loadDetails(), 10_000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetails]);

  const updateStatus = async (status: string) => {
    setError("");
    const response = await fetch(`/api/operations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Falha ao atualizar");
      return;
    }
    await Promise.all([loadOperations(), loadDetails()]);
  };

  const members = useMemo(() => (details?.members || []) as Member[], [details]);
  const locations = useMemo(() => (details?.locations || []) as Location[], [details]);
  const latestByMember = useMemo(
    () => new Map(locations.map((location) => [location.member_id, location])),
    [locations],
  );
  const alerts = members.filter((member) => ["sos", "help_requested", "rest_requested", "off_route"].includes(member.last_status));
  const connected = members.filter((member) => isRecent(member.last_seen_at, 3)).length;

  return (
    <main className="min-h-screen bg-[#EEF3F6] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071829] px-4 py-4 text-white shadow-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button type="button" onClick={() => router.push("/admin")} className="rounded-xl bg-white/10 p-2.5 hover:bg-white/15" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">Segurança de campo</p>
            <h1 className="truncate text-xl font-black">Central de operações</h1>
          </div>
          <button type="button" onClick={() => void loadDetails()} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-3 sm:p-5 lg:grid-cols-[290px_1fr]">
        <aside className="rounded-[1.75rem] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="font-black">Operações</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{operations.length}</span>
          </div>
          <div className="max-h-[70dvh] space-y-2 overflow-y-auto">
            {operations.map((operation) => (
              <button
                key={operation.id}
                type="button"
                onClick={() => setSelectedId(operation.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selectedId === operation.id ? "border-orange-300 bg-orange-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                }`}
              >
                <span className="block text-sm font-black">{operation.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{statusLabels[operation.status] || operation.status}</span>
              </button>
            ))}
            {!loading && !operations.length ? <p className="p-3 text-sm text-slate-500">Crie a primeira operação no aplicativo do guia.</p> : null}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {details ? (
            <>
              <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071829,#143858)] p-5 text-white shadow-xl sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-orange-300">{statusLabels[details.operation.status]}</p>
                    <h2 className="mt-1 text-2xl font-black">{details.operation.name}</h2>
                    <p className="mt-2 text-sm text-blue-100/70">{details.operation.agendas?.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["check_in", "active", "paused", "completed"].map((status) => (
                      <button key={status} type="button" onClick={() => void updateStatus(status)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">
                        {statusLabels[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric icon={Users} label="Integrantes" value={members.length} />
                <Metric icon={Radio} label="Contato recente" value={connected} />
                <Metric icon={MapPin} label="Com posição" value={locations.length} />
                <Metric icon={AlertTriangle} label="Alertas" value={alerts.length} danger={alerts.length > 0} />
              </div>

              {alerts.length ? (
                <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-4">
                  <h3 className="flex items-center gap-2 font-black text-red-800"><AlertTriangle className="h-5 w-5" /> Atenção imediata</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {alerts.map((member) => (
                      <div key={member.id} className="rounded-2xl bg-white p-3 text-sm font-bold text-red-800">
                        {member.display_name} · {memberLabels[member.last_status]}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[1.75rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-black">Situação do grupo</h3>
                  <span className="text-xs font-bold text-slate-400">atualiza a cada 10 segundos</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map((member) => {
                    const location = latestByMember.get(member.id);
                    return (
                      <article key={member.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-3">
                          <span className={`h-3 w-3 rounded-full ${memberColor(member.last_status)}`} />
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-black">{member.display_name}</h4>
                            <p className="text-xs text-slate-500">{memberLabels[member.last_status] || member.last_status}</p>
                          </div>
                          <span className="flex items-center gap-1 text-xs font-black text-slate-500"><Battery className="h-3.5 w-3.5" /> {member.battery_percent ?? "—"}%</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {timeAgo(member.last_seen_at)}</span>
                          {location ? (
                            <a className="font-black text-[#0B2540]" href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Abrir posição</a>
                          ) : <span>Sem GPS</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.75rem] bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 font-black">Relatórios</h3>
                {details.reports?.length ? details.reports.map((report: any) => (
                  <div key={report.id} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
                    <Activity className={`h-5 w-5 ${report.status === "resolved" ? "text-emerald-600" : "text-orange-500"}`} />
                    <div>
                      <p className="text-sm font-black">{report.title}</p>
                      <p className="text-xs text-slate-500">{report.description || report.report_type}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500">Nenhum relatório recebido.</p>}
              </div>
            </>
          ) : (
            <div className="grid min-h-[50dvh] place-items-center rounded-[2rem] bg-white">
              <div className="text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-[#0B2540]" />
                <p className="mt-3 font-black">{loading ? "Carregando central…" : "Selecione uma operação"}</p>
              </div>
            </div>
          )}
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, danger = false }: { icon: typeof Users; label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${danger ? "bg-red-600 text-white" : "bg-white"}`}>
      <Icon className={`h-5 w-5 ${danger ? "text-white" : "text-[#D96224]"}`} />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className={`text-xs font-bold ${danger ? "text-red-100" : "text-slate-500"}`}>{label}</p>
    </div>
  );
}

function isRecent(value: string | null | undefined, minutes: number) {
  return Boolean(value && Date.now() - Date.parse(value) < minutes * 60_000);
}
function timeAgo(value?: string | null) {
  if (!value) return "Nunca";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1 ? "Agora" : `${minutes} min`;
}
function memberColor(status: string) {
  if (status === "sos") return "bg-red-600";
  if (status === "help_requested") return "bg-orange-600";
  if (status === "rest_requested") return "bg-amber-500";
  return "bg-emerald-600";
}
