import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

type LoyaltyUpdate =
  | {
      kind?: "config";
      enabled?: boolean;
      basePointsPerBrl?: number;
      minimumMarginPercent?: number;
      providerFeePercent?: number;
      providerFixedFee?: number;
      maxOrderDiscountPercent?: number;
      reserveCoverageRatio?: number;
    }
  | {
      kind: "agenda";
      agendaId?: string;
      costsConfirmed?: boolean;
      variableCostPerPerson?: number;
      safetyBuffer?: number;
    };

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdmin();
  const [summaryResult, agendasResult, costsResult, reservationsResult, snapshotsResult] =
    await Promise.all([
      supabase.rpc("get_loyalty_financial_summary"),
      supabase
        .from("agendas")
        .select(
          "id, title, date, price, loyalty_costs_confirmed_at, loyalty_variable_cost_per_person, loyalty_safety_buffer",
        )
        .order("date", { ascending: false }),
      supabase.from("trilha_custos").select("agenda_id, valor_custo"),
      supabase
        .from("reservas")
        .select("agenda_id, status_pagamento"),
      supabase
        .from("loyalty_balance_snapshots")
        .select(
          "id, status, coverage_ratio, current_award_rate, points_liability, available_reward_reserve, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const firstError = [
    summaryResult.error,
    agendasResult.error,
    costsResult.error,
    reservationsResult.error,
    snapshotsResult.error,
  ].find(Boolean);
  if (firstError) {
    console.error("Falha ao carregar o balanceamento de fidelidade:", firstError);
    return NextResponse.json(
      { error: "Não foi possível calcular o balanceamento agora" },
      { status: 500 },
    );
  }

  const costsByAgenda = new Map<string, number>();
  for (const cost of costsResult.data || []) {
    const agendaId = String(cost.agenda_id);
    costsByAgenda.set(
      agendaId,
      (costsByAgenda.get(agendaId) || 0) + Number(cost.valor_custo || 0),
    );
  }
  const paidByAgenda = new Map<string, number>();
  for (const reservation of reservationsResult.data || []) {
    if (reservation.status_pagamento !== "pago") continue;
    const agendaId = String(reservation.agenda_id);
    paidByAgenda.set(agendaId, (paidByAgenda.get(agendaId) || 0) + 1);
  }

  return NextResponse.json({
    summary: summaryResult.data,
    agendas: (agendasResult.data || []).map((agenda) => ({
      ...agenda,
      declared_costs: costsByAgenda.get(String(agenda.id)) || 0,
      paid_reservations: paidByAgenda.get(String(agenda.id)) || 0,
    })),
    snapshots: snapshotsResult.data || [],
  });
}

export async function PATCH(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<LoyaltyUpdate>(request, 30_000);
  if (parsed.response) return parsed.response;
  const input = parsed.data;
  const supabase = createSupabaseAdmin();

  if (input.kind === "agenda") {
    const agendaId = String(input.agendaId || "");
    if (!isUuid(agendaId)) {
      return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });
    }
    const variableCost = finiteRange(input.variableCostPerPerson, 0, 1_000_000);
    const safetyBuffer = finiteRange(input.safetyBuffer, 0, 10_000_000);
    if (variableCost === null || safetyBuffer === null) {
      return NextResponse.json(
        { error: "Custos de segurança inválidos" },
        { status: 400 },
      );
    }

    if (input.costsConfirmed === true) {
      const { data: costs, error: costsError } = await supabase
        .from("trilha_custos")
        .select("valor_custo")
        .eq("agenda_id", agendaId);
      if (costsError) {
        return NextResponse.json(
          { error: "Não foi possível conferir os custos da trilha" },
          { status: 500 },
        );
      }
      const total = (costs || []).reduce(
        (sum, cost) => sum + Number(cost.valor_custo || 0),
        0,
      );
      if (total <= 0) {
        return NextResponse.json(
          { error: "Cadastre os custos da trilha antes de confirmá-los" },
          { status: 409 },
        );
      }
    }

    const { error } = await supabase
      .from("agendas")
      .update({
        loyalty_costs_confirmed_at: input.costsConfirmed
          ? new Date().toISOString()
          : null,
        loyalty_costs_confirmed_by: input.costsConfirmed ? auth.user.id : null,
        loyalty_variable_cost_per_person: variableCost,
        loyalty_safety_buffer: safetyBuffer,
      })
      .eq("id", agendaId);
    if (error) {
      console.error("Falha ao confirmar os custos da trilha:", error);
      return NextResponse.json(
        { error: "Não foi possível atualizar a proteção da trilha" },
        { status: 500 },
      );
    }

    await writeAudit(supabase, auth.user.id, auth.user.email, {
      action: input.costsConfirmed
        ? "loyalty.agenda_costs_confirmed"
        : "loyalty.agenda_costs_reopened",
      resourceId: agendaId,
      metadata: { variableCost, safetyBuffer },
    });
  } else {
    const update = {
      enabled: input.enabled !== false,
      base_points_per_brl_earned: finiteRange(
        input.basePointsPerBrl,
        0,
        10,
      ),
      minimum_margin_percent: percent(input.minimumMarginPercent, 0, 80),
      provider_fee_percent: percent(input.providerFeePercent, 0, 30),
      provider_fixed_fee: finiteRange(input.providerFixedFee, 0, 100),
      max_order_discount_percent: percent(
        input.maxOrderDiscountPercent,
        0,
        30,
      ),
      reserve_coverage_ratio: finiteRange(
        input.reserveCoverageRatio,
        1,
        5,
      ),
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };
    if (Object.values(update).some((value) => value === null)) {
      return NextResponse.json(
        { error: "Parâmetros financeiros inválidos" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("loyalty_program_config")
      .update(update)
      .eq("singleton", true);
    if (error) {
      console.error("Falha ao atualizar a política de fidelidade:", error);
      return NextResponse.json(
        { error: "Não foi possível salvar a política" },
        { status: 500 },
      );
    }
    await writeAudit(supabase, auth.user.id, auth.user.email, {
      action: "loyalty.config_updated",
      resourceId: "singleton",
      metadata: update,
    });
  }

  await supabase.rpc("record_loyalty_balance_snapshot", {
    p_triggered_by: auth.user.email || auth.user.id,
  });
  const { data: summary, error: summaryError } = await supabase.rpc(
    "get_loyalty_financial_summary",
  );
  if (summaryError) {
    return NextResponse.json(
      { error: "Configuração salva, mas o novo saldo não pôde ser calculado" },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, summary });
}

function finiteRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function percent(
  value: number | undefined,
  minimum: number,
  maximum: number,
) {
  const number = finiteRange(value, minimum, maximum);
  return number === null ? null : number / 100;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function writeAudit(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  email: string | undefined,
  input: {
    action: string;
    resourceId: string;
    metadata: Record<string, unknown>;
  },
) {
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    actor_email: email,
    action: input.action,
    resource_type: "loyalty_balance",
    resource_id: input.resourceId,
    metadata: input.metadata,
  });
}
