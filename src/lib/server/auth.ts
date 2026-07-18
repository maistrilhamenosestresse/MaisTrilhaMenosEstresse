import "server-only";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getAdminEmails } from "@/lib/server/env";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type AuthSuccess = { user: User; response?: never };
type AuthFailure = { user?: never; response: NextResponse };

export async function requireAuthenticatedUser(): Promise<AuthSuccess | AuthFailure> {
  const authorization = (await headers()).get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    const { data: { user }, error } = await createSupabaseAdmin().auth.getUser(bearer);
    if (!error && user) return { user };
    return {
      response: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }),
    };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }),
    };
  }

  return { user };
}

export async function requireAuthenticatedRequest(request: Request): Promise<AuthSuccess | AuthFailure> {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return requireAuthenticatedUser();

  const { data: { user }, error } = await createSupabaseAdmin().auth.getUser(bearer);
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

  if (!(await isAdminUser(auth.user))) {
    return {
      response: NextResponse.json({ error: "Acesso administrativo negado" }, { status: 403 }),
    };
  }

  return auth;
}

export async function requireAdminRequest(request: Request): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth;
  if (!(await isAdminUser(auth.user))) {
    return {
      response: NextResponse.json({ error: "Acesso administrativo negado" }, { status: 403 }),
    };
  }
  return auth;
}

export async function isAdminUser(user: User) {
  const email = user.email?.toLowerCase();
  const metadataRole = user.app_metadata?.role;
  const { data: profile } = await createSupabaseAdmin()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin" ||
    metadataRole === "admin" ||
    (!!email && getAdminEmails().includes(email));
}

export async function requireAgendaCustomer(agendaId: string): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth;

  const supabase = createSupabaseAdmin();
  const client = await resolveAuthenticatedClient(auth.user);

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

export async function resolveAuthenticatedClient(user: User) {
  const supabase = createSupabaseAdmin();
  const { data: linked } = await supabase
    .from("clients")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (linked) return linked;
  if (!user.email) return null;

  const { data: byEmail } = await supabase
    .from("clients")
    .select("*")
    .ilike("email", user.email)
    .limit(1)
    .maybeSingle();
  if (!byEmail) return null;
  if (byEmail.auth_user_id && byEmail.auth_user_id !== user.id) return null;

  if (!byEmail.auth_user_id) {
    const { data: claimed } = await supabase
      .from("clients")
      .update({ auth_user_id: user.id })
      .eq("id", byEmail.id)
      .is("auth_user_id", null)
      .select("*")
      .maybeSingle();
    return claimed || null;
  }

  return byEmail;
}
