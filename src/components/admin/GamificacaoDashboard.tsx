"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Medal,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { getAdventureProgress } from "@/lib/gamification";

type RankingClient = {
  id: string;
  name: string;
  email: string;
  points: number;
  experience: number;
  level: string;
};

type LoyaltySummary = {
  status: "healthy" | "watch" | "blocked";
  enabled: boolean;
  outstanding_points: number;
  points_liability: number;
  cashback_liability: number;
  estimated_gross_revenue: number;
  declared_costs: number;
  estimated_provider_fees: number;
  protected_margin: number;
  available_reward_reserve: number;
  required_reward_reserve: number;
  coverage_ratio: number | null;
  sold_agendas: number;
  cost_confirmed_agendas: number;
  cost_completeness_ratio: number;
  current_award_rate: number;
  calculated_at: string;
  config: {
    points_per_brl_discount: number;
    base_points_per_brl_earned: number;
    minimum_margin_percent: number;
    provider_fee_percent: number;
    provider_fixed_fee: number;
    max_order_discount_percent: number;
    reserve_coverage_ratio: number;
  };
};

type LoyaltyAgenda = {
  id: string;
  title: string;
  date: string;
  price: number;
  loyalty_costs_confirmed_at: string | null;
  loyalty_variable_cost_per_person: number;
  loyalty_safety_buffer: number;
  declared_costs: number;
  paid_reservations: number;
};

type ConfigDraft = {
  enabled: boolean;
  basePointsPerBrl: number;
  minimumMarginPercent: number;
  providerFeePercent: number;
  providerFixedFee: number;
  maxOrderDiscountPercent: number;
  reserveCoverageRatio: number;
};

export default function GamificacaoDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [ranking, setRanking] = useState<RankingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPoints: 0, totalExperience: 0, engagedUsers: 0 });
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [agendas, setAgendas] = useState<LoyaltyAgenda[]>([]);
  const [config, setConfig] = useState<ConfigDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [adjustmentOperation, setAdjustmentOperation] = useState<"add" | "remove">("add");
  const [adjustmentPoints, setAdjustmentPoints] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustingPoints, setAdjustingPoints] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const applyBalance = useCallback((
    nextSummary: LoyaltySummary,
    nextAgendas: LoyaltyAgenda[],
  ) => {
    setSummary(nextSummary);
    setAgendas(nextAgendas);
    setConfig({
      enabled: nextSummary.enabled,
      basePointsPerBrl: Number(nextSummary.config.base_points_per_brl_earned),
      minimumMarginPercent: Number(nextSummary.config.minimum_margin_percent) * 100,
      providerFeePercent: Number(nextSummary.config.provider_fee_percent) * 100,
      providerFixedFee: Number(nextSummary.config.provider_fixed_fee),
      maxOrderDiscountPercent: Number(nextSummary.config.max_order_discount_percent) * 100,
      reserveCoverageRatio: Number(nextSummary.config.reserve_coverage_ratio),
    });
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      const [rankingResult, balanceResponse] = await Promise.all([
        createClient()
        .from("clients")
        .select("id, full_name, email, pontos, experiencia")
        .order("experiencia", { ascending: false, nullsFirst: false }),
        fetch("/api/admin/loyalty-balance", { cache: "no-store" }),
      ]);

      const clients = rankingResult.data || [];
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
          email: client.email || "",
          points,
          experience,
          level: getAdventureProgress(experience).current.name,
        };
      });

      setStats({ totalPoints, totalExperience, engagedUsers });
      setRanking(mapped);
      const balanceResult = await balanceResponse.json();
      if (!balanceResponse.ok) {
        setBalanceError(balanceResult.error || "Falha ao calcular o balanceamento.");
      } else {
        applyBalance(balanceResult.summary, balanceResult.agendas || []);
      }
      setLoading(false);
    };
    void loadDashboard();
  }, [applyBalance]);

  const refreshBalance = async () => {
    setBalanceError("");
    const response = await fetch("/api/admin/loyalty-balance", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setBalanceError(result.error || "Falha ao atualizar o balanceamento.");
      return;
    }
    applyBalance(result.summary, result.agendas || []);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setBalanceError("");
    try {
      const response = await fetch("/api/admin/loyalty-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "config", ...config }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      await refreshBalance();
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateAgendaProtection = async (
    agendaId: string,
    costsConfirmed: boolean,
    variableCostPerPerson: number,
    safetyBuffer: number,
  ) => {
    setSaving(true);
    setBalanceError("");
    try {
      const response = await fetch("/api/admin/loyalty-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "agenda",
          agendaId,
          costsConfirmed,
          variableCostPerPerson,
          safetyBuffer,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao atualizar.");
      await refreshBalance();
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : "Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRanking = useMemo(() => ranking.filter((client) =>
    `${client.name} ${client.email}`.toLocaleLowerCase("pt-BR").includes(searchTerm.toLocaleLowerCase("pt-BR")),
  ), [ranking, searchTerm]);

  const selectedClient = ranking.find((client) => client.id === selectedClientId) || null;
  const pointsAmount = Math.max(0, Number(adjustmentPoints || 0));
  const projectedBalance = selectedClient
    ? selectedClient.points + (adjustmentOperation === "add" ? pointsAmount : -pointsAmount)
    : 0;

  const submitPointsAdjustment = async () => {
    if (!selectedClient || !Number.isInteger(pointsAmount) || pointsAmount < 1 || adjustmentReason.trim().length < 5) return;
    setAdjustingPoints(true);
    setAdjustmentMessage(null);
    try {
      const response = await fetch("/api/admin/points-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          operation: adjustmentOperation,
          points: pointsAmount,
          reason: adjustmentReason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível ajustar os pontos.");
      const newBalance = Number(result.adjustment?.new_balance ?? projectedBalance);
      const difference = newBalance - selectedClient.points;
      setRanking((current) => current.map((client) => client.id === selectedClient.id ? { ...client, points: newBalance } : client));
      const engagementDelta = selectedClient.experience === 0
        ? selectedClient.points === 0 && newBalance > 0
          ? 1
          : selectedClient.points > 0 && newBalance === 0
            ? -1
            : 0
        : 0;
      setStats((current) => ({
        ...current,
        totalPoints: Math.max(0, current.totalPoints + difference),
        engagedUsers: Math.max(0, current.engagedUsers + engagementDelta),
      }));
      setAdjustmentPoints("");
      setAdjustmentReason("");
      setAdjustmentMessage({ kind: "success", text: `Saldo de ${selectedClient.name} atualizado para ${newBalance.toLocaleString("pt-BR")} pontos.` });
      await refreshBalance();
    } catch (error) {
      setAdjustmentMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível ajustar os pontos." });
    } finally {
      setAdjustingPoints(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#0B2540]" /></div>;
  }

  return (
    <div className="space-y-6">
      {balanceError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          {balanceError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#FFF7ED,#FFFFFF)] p-5 md:grid-cols-[1fr_auto] md:p-7">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#B94E16]"><BookOpen className="h-3.5 w-3.5" /> Comece por aqui</span>
            <h2 className="mt-3 text-2xl font-black text-[#071829]">Como os pontos funcionam</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Pontos são usados somente como desconto: <strong>200 pontos valem R$ 1,00</strong>.
              Experiência (XP) define o nível e nunca é gasta. O sistema calcula automaticamente
              quanto pode conceder sem comprometer a margem.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[390px]">
            <SimpleStep number="1" title="Venda paga" text="gera pontos" />
            <SimpleStep number="2" title="Cliente usa" text="como desconto" />
            <SimpleStep number="3" title="Cancelamento" text="estorna pontos" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-800"><Star className="h-5 w-5 text-amber-500" /> Ajustar pontos de um cliente</h2>
            <p className="mt-1 text-sm text-slate-500">Use somente para correções, bônus ou estornos manuais. Toda mudança exige motivo e fica registrada.</p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Histórico protegido</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.7fr_.65fr]">
          <label>
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">1. Escolha a pessoa</span>
            <select value={selectedClientId} onChange={(event) => { setSelectedClientId(event.target.value); setAdjustmentMessage(null); }} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200">
              <option value="">Selecione pelo nome</option>
              {[...ranking].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((client) => <option key={client.id} value={client.id}>{client.name} · {client.points.toLocaleString("pt-BR")} pts</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-xs font-black uppercase tracking-wider text-slate-600">2. Tipo de ajuste</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAdjustmentOperation("add")} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-xs font-black ${adjustmentOperation === "add" ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 text-slate-500"}`}><PlusCircle className="h-4 w-4" /> Adicionar</button>
              <button type="button" onClick={() => setAdjustmentOperation("remove")} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-xs font-black ${adjustmentOperation === "remove" ? "border-red-400 bg-red-50 text-red-800 ring-2 ring-red-100" : "border-slate-200 bg-slate-50 text-slate-500"}`}><MinusCircle className="h-4 w-4" /> Retirar</button>
            </div>
          </fieldset>
          <label>
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">3. Quantidade</span>
            <input type="number" min={1} max={100000} step={1} value={adjustmentPoints} onChange={(event) => setAdjustmentPoints(event.target.value)} placeholder="Ex.: 200" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:ring-2 focus:ring-orange-200" />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600">4. Por que está fazendo esta mudança?</span>
          <textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={180} rows={3} placeholder="Ex.: Correção referente à compra manual da trilha..." className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:ring-2 focus:ring-orange-200" />
        </label>

        {selectedClient ? <div className={`mt-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center ${projectedBalance < 0 ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50/60"}`}>
          <div><span className="block text-[10px] font-black uppercase text-slate-500">Saldo atual</span><strong className="text-xl text-slate-800">{selectedClient.points.toLocaleString("pt-BR")} pts</strong></div>
          <ArrowRight className="hidden h-5 w-5 text-slate-400 sm:block" />
          <div className="sm:text-right"><span className="block text-[10px] font-black uppercase text-slate-500">Saldo depois da alteração</span><strong className={`text-xl ${projectedBalance < 0 ? "text-red-700" : "text-[#0B2540]"}`}>{projectedBalance.toLocaleString("pt-BR")} pts</strong><span className="block text-[10px] text-slate-500">até {formatCurrency(Math.max(0, projectedBalance) / 200)} em desconto</span></div>
        </div> : null}

        {adjustmentMessage ? <p className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${adjustmentMessage.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{adjustmentMessage.text}</p> : null}

        <button type="button" onClick={() => void submitPointsAdjustment()} disabled={adjustingPoints || !selectedClient || !Number.isInteger(pointsAmount) || pointsAmount < 1 || projectedBalance < 0 || adjustmentReason.trim().length < 5} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40 md:w-auto">{adjustingPoints ? <Loader2 className="h-5 w-5 animate-spin" /> : adjustmentOperation === "add" ? <PlusCircle className="h-5 w-5" /> : <MinusCircle className="h-5 w-5" />} Confirmar ajuste com histórico</button>
      </section>

      {summary ? (
        <>
          <section className="overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#061526,#12385E)] text-white shadow-xl">
            <div className="grid gap-6 p-5 md:grid-cols-[1.4fr_1fr] md:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                    summary.status === "healthy"
                      ? "bg-emerald-400/20 text-emerald-200"
                      : summary.status === "watch"
                        ? "bg-amber-400/20 text-amber-100"
                        : "bg-red-400/20 text-red-100"
                  }`}>
                    {summary.status === "healthy"
                      ? "Fundo saudável"
                      : summary.status === "watch"
                        ? "Atenção"
                        : "Emissão protegida"}
                  </span>
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-blue-100">
                    cálculo em tempo real
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-black md:text-3xl">
                  Central de balanceamento dos pontos
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100/75">
                  O sistema protege a margem antes de emitir ou aceitar pontos.
                  Custos não confirmados bloqueiam automaticamente o benefício da trilha,
                  sem apagar os pontos que o cliente já conquistou.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-200">
                  Taxa de emissão atual
                </p>
                <p className="mt-2 text-4xl font-black">
                  {Number(summary.current_award_rate).toLocaleString("pt-BR", {
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="mt-1 text-xs text-blue-100/70">
                  ponto(s) por R$ 1 pago em novas compras elegíveis
                </p>
                <button
                  type="button"
                  onClick={() => void refreshBalance()}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#0B2540]"
                >
                  <RefreshCw className="h-4 w-4" /> Recalcular agora
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BalanceMetric
              icon={CircleDollarSign}
              label="Passivo dos pontos"
              value={formatCurrency(summary.points_liability)}
              help={`${Number(summary.outstanding_points).toLocaleString("pt-BR")} pontos disponíveis`}
            />
            <BalanceMetric
              icon={ShieldCheck}
              label="Reserva disponível"
              value={formatCurrency(summary.available_reward_reserve)}
              help={`Reserva exigida: ${formatCurrency(summary.required_reward_reserve)}`}
            />
            <BalanceMetric
              icon={Calculator}
              label="Cobertura"
              value={summary.coverage_ratio === null
                ? "Sem passivo"
                : `${Number(summary.coverage_ratio).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×`}
              help={`Meta mínima: ${Number(summary.config.reserve_coverage_ratio).toLocaleString("pt-BR")}×`}
            />
            <BalanceMetric
              icon={CheckCircle2}
              label="Custos confirmados"
              value={`${summary.cost_confirmed_agendas}/${summary.sold_agendas}`}
              help={`${Math.round(Number(summary.cost_completeness_ratio) * 100)}% das trilhas com vendas`}
            />
          </div>

          {config ? (
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black text-gray-800">Política de proteção</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Ajuste conservador. Alterações afetam somente novas decisões.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveConfig()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0B2540] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar proteção
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <NumberField
                  label="Pontos base por R$ 1"
                  value={config.basePointsPerBrl}
                  min={0}
                  max={10}
                  step={0.25}
                  onChange={(value) => setConfig({ ...config, basePointsPerBrl: value })}
                />
                <NumberField
                  label="Margem mínima protegida"
                  suffix="%"
                  value={config.minimumMarginPercent}
                  min={0}
                  max={80}
                  step={1}
                  onChange={(value) => setConfig({ ...config, minimumMarginPercent: value })}
                />
                <NumberField
                  label="Taxa conservadora do provedor"
                  suffix="%"
                  value={config.providerFeePercent}
                  min={0}
                  max={30}
                  step={0.1}
                  onChange={(value) => setConfig({ ...config, providerFeePercent: value })}
                />
                <NumberField
                  label="Tarifa fixa estimada"
                  prefix="R$"
                  value={config.providerFixedFee}
                  min={0}
                  max={100}
                  step={0.01}
                  onChange={(value) => setConfig({ ...config, providerFixedFee: value })}
                />
                <NumberField
                  label="Desconto máximo por compra"
                  suffix="%"
                  value={config.maxOrderDiscountPercent}
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(value) => setConfig({ ...config, maxOrderDiscountPercent: value })}
                />
                <NumberField
                  label="Cobertura mínima do fundo"
                  suffix="×"
                  value={config.reserveCoverageRatio}
                  min={1}
                  max={5}
                  step={0.05}
                  onChange={(value) => setConfig({ ...config, reserveCoverageRatio: value })}
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-black text-gray-800">Custos por trilha</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Confirme somente depois de cadastrar hospedagem, transporte, guia,
                entradas, alimentação, seguro e demais despesas. Sem confirmação,
                o checkout não usa pontos.
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {agendas
                .filter((agenda) => agenda.paid_reservations > 0 || new Date(agenda.date) >= new Date())
                .slice(0, 20)
                .map((agenda) => (
                  <AgendaProtectionRow
                    key={agenda.id}
                    agenda={agenda}
                    disabled={saving}
                    onSave={updateAgendaProtection}
                  />
                ))}
            </div>
          </section>
        </>
      ) : null}

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

function SimpleStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-3 text-center shadow-sm">
      <span className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-[#D96224] text-xs font-black text-white">{number}</span>
      <strong className="mt-2 block text-[11px] text-slate-800">{title}</strong>
      <span className="block text-[9px] text-slate-500">{text}</span>
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

function BalanceMetric({
  icon: Icon,
  label,
  value,
  help,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E7EEF6] text-[#0B2540]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-800">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{help}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <span className="block text-xs font-black text-gray-700">{label}</span>
      <span className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        {prefix ? <span className="text-xs font-bold text-gray-400">{prefix}</span> : null}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-black text-gray-800 outline-none"
        />
        {suffix ? <span className="text-xs font-bold text-gray-400">{suffix}</span> : null}
      </span>
    </label>
  );
}

function AgendaProtectionRow({
  agenda,
  disabled,
  onSave,
}: {
  agenda: LoyaltyAgenda;
  disabled: boolean;
  onSave: (
    agendaId: string,
    costsConfirmed: boolean,
    variableCostPerPerson: number,
    safetyBuffer: number,
  ) => Promise<void>;
}) {
  const [variableCost, setVariableCost] = useState(
    Number(agenda.loyalty_variable_cost_per_person || 0),
  );
  const [safetyBuffer, setSafetyBuffer] = useState(
    Number(agenda.loyalty_safety_buffer || 0),
  );
  const confirmed = Boolean(agenda.loyalty_costs_confirmed_at);

  useEffect(() => {
    setVariableCost(Number(agenda.loyalty_variable_cost_per_person || 0));
    setSafetyBuffer(Number(agenda.loyalty_safety_buffer || 0));
  }, [
    agenda.loyalty_safety_buffer,
    agenda.loyalty_variable_cost_per_person,
  ]);

  return (
    <article className="rounded-2xl border border-gray-200 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-gray-800">{agenda.title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
              confirmed
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {confirmed ? "Custos confirmados" : "Proteção ativa"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {new Date(agenda.date).toLocaleDateString("pt-BR")} ·{" "}
            {agenda.paid_reservations} venda(s) paga(s) · custos cadastrados{" "}
            <strong>{formatCurrency(agenda.declared_costs)}</strong>
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[390px]">
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <span className="block text-[10px] font-bold text-gray-500">Custo variável por pessoa</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={variableCost}
              onChange={(event) => setVariableCost(Number(event.target.value))}
              className="mt-1 w-full bg-transparent text-sm font-black outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <span className="block text-[10px] font-bold text-gray-500">Reserva extra de segurança</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={safetyBuffer}
              onChange={(event) => setSafetyBuffer(Number(event.target.value))}
              className="mt-1 w-full bg-transparent text-sm font-black outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={disabled || (!confirmed && agenda.declared_costs <= 0)}
          onClick={() =>
            void onSave(agenda.id, !confirmed, variableCost, safetyBuffer)
          }
          className={`min-h-11 rounded-xl px-4 py-3 text-xs font-black disabled:opacity-40 ${
            confirmed
              ? "border border-amber-300 bg-amber-50 text-amber-800"
              : "bg-emerald-700 text-white"
          }`}
        >
          {confirmed ? "Reabrir custos" : "Confirmar todos os custos"}
        </button>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
