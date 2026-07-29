import { NextResponse } from "next/server";
import {
  type AgendaMutationInput,
  isValidAgendaId,
  parseAgendaMutation,
  requireArchivedAgendaUnlock,
} from "@/lib/server/admin-agendas";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isArchivedTrailDate } from "@/lib/trails";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isValidAgendaId(id)) {
    return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });
  }
  const parsed = await readJsonBody<AgendaMutationInput>(request, 100_000);
  if (parsed.response) return parsed.response;

  const supabase = createSupabaseAdmin();
  const { data: current } = await supabase
    .from("agendas")
    .select("id, date, title")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Trilha não encontrada" }, { status: 404 });
  }

  try {
    const agenda = parseAgendaMutation(parsed.data);
    const lockResponse = await requireArchivedAgendaUnlock(
      auth.user.id,
      current.date,
      agenda.date,
    );
    if (lockResponse) return lockResponse;

    const { data, error } = await supabase
      .from("agendas")
      .update(agenda)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Não foi possível atualizar a trilha" },
        { status: 400 },
      );
    }

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: "agenda.updated",
      resource_type: "agenda",
      resource_id: id,
      metadata: {
        archived: isArchivedTrailDate(current.date),
        previous_date: current.date,
        next_date: data.date,
      },
    });
    return NextResponse.json({ agenda: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dados inválidos" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isValidAgendaId(id)) {
    return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: current } = await supabase
    .from("agendas")
    .select("id, date, title")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Trilha não encontrada" }, { status: 404 });
  }

  const lockResponse = await requireArchivedAgendaUnlock(
    auth.user.id,
    current.date,
  );
  if (lockResponse) return lockResponse;

  const { error } = await supabase.from("agendas").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "A trilha possui vínculos e não pode ser excluída" },
      { status: 409 },
    );
  }

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "agenda.deleted",
    resource_type: "agenda",
    resource_id: id,
    metadata: { date: current.date, title: current.title },
  });
  return NextResponse.json({ success: true });
}
