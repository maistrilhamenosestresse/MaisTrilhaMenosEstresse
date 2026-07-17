import "server-only";

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getAdminEmails } from "@/lib/server/env";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type AuthSuccess = { user: User; response?: never };
type AuthFailure = { user?: never; response: NextResponse };

export async function requireAuthenticatedUser(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }),
    };
  }

  return { user };
}

export async function requireAdminUser(): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth;

  const email = auth.user.email?.toLowerCase();
  const metadataRole = auth.user.app_metadata?.role;
  const isAdmin = metadataRole === "admin" || (!!email && getAdminEmails().includes(email));

  if (!isAdmin) {
    return {
      response: NextResponse.json({ error: "Acesso administrativo negado" }, { status: 403 }),
    };
  }

  return auth;
}

export async function requireAgendaCustomer(agendaId: string): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth;

  const supabase = createSupabaseAdmin();
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .or(`auth_user_id.eq.${auth.user.id},email.eq.${auth.user.email || ''}`)
    .limit(1)
    .maybeSingle();

  if (!client) {
    return { response: NextResponse.json({ error: 'Cliente não encontrado' }, { status: 403 }) };
  }

  const { data: reservation } = await supabase
    .from('reservas')
    .select('id')
    .eq('client_id', client.id)
    .eq('agenda_id', agendaId)
    .eq('status_pagamento', 'pago')
    .limit(1)
    .maybeSingle();

  if (!reservation) {
    return { response: NextResponse.json({ error: 'Acesso ao álbum não autorizado' }, { status: 403 }) };
  }

  return auth;
}
