import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  resolveAuthenticatedClient,
} from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

type QuoteBody = {
  reservationIds?: string[];
  grossAmount?: number;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<QuoteBody>(request, 20_000);
  if (parsed.response) return parsed.response;

  const reservationIds = [...new Set(parsed.data.reservationIds || [])];
  const grossAmount = Number(parsed.data.grossAmount);
  if (
    !reservationIds.length ||
    reservationIds.length > 20 ||
    reservationIds.some((id) => !isUuid(id)) ||
    !Number.isFinite(grossAmount) ||
    grossAmount <= 0 ||
    grossAmount > 1_000_000
  ) {
    return NextResponse.json(
      { error: "Dados inválidos para calcular o desconto" },
      { status: 400 },
    );
  }

  const principal = await resolveAuthenticatedClient(auth.user);
  if (!principal) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 403 });
  }

  const { data, error } = await createSupabaseAdmin().rpc(
    "quote_app_trail_points",
    {
      p_reservation_ids: reservationIds,
      p_owner_id: principal.id,
      p_gross_amount: grossAmount,
    },
  );
  if (error) {
    console.error("Falha na cotação protegida de pontos:", error);
    return NextResponse.json(
      { error: "Não foi possível calcular o desconto agora" },
      { status: 409 },
    );
  }
  return NextResponse.json({ quote: data });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
