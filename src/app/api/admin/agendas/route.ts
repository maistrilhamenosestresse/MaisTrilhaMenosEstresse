import { NextResponse } from "next/server";
import {
  type AgendaMutationInput,
  parseAgendaMutation,
} from "@/lib/server/admin-agendas";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isArchivedTrailDate } from "@/lib/trails";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<AgendaMutationInput>(request, 100_000);
  if (parsed.response) return parsed.response;

  try {
    const agenda = parseAgendaMutation(parsed.data);
    if (isArchivedTrailDate(agenda.date)) {
      return NextResponse.json(
        { error: "Não é permitido cadastrar uma nova trilha com data encerrada" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("agendas")
      .insert(agenda)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Não foi possível cadastrar a trilha" },
        { status: 400 },
      );
    }

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: "agenda.created",
      resource_type: "agenda",
      resource_id: data.id,
      metadata: { date: data.date, title: data.title },
    });
    return NextResponse.json({ agenda: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dados inválidos" },
      { status: 400 },
    );
  }
}
