import { NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

type DependentInput = { name?: string; cpf?: string; phone?: string };
type ReservationItem = { agendaId?: string; dependents?: DependentInput[] };
type ReservationBody = { items?: ReservationItem[]; agenda_id?: string; client_id?: string };

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<ReservationBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const items = parsed.data.items?.length
    ? parsed.data.items
    : [{ agendaId: parsed.data.agenda_id, dependents: [] }];
  if (!items.length || items.length > 10 || items.some((item) => !isUuid(item.agendaId || ''))) {
    return NextResponse.json({ error: 'Itens de reserva inválidos' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let { data: principal } = await supabase.from('clients').select('id, email').eq('auth_user_id', auth.user.id).maybeSingle();
  if (!principal && auth.user.email) {
    const result = await supabase.from('clients').select('id, email').ilike('email', auth.user.email).limit(1).maybeSingle();
    principal = result.data;
    if (principal) await supabase.from('clients').update({ auth_user_id: auth.user.id }).eq('id', principal.id);
  }
  if (!principal) return NextResponse.json({ error: 'Complete seu cadastro antes de reservar' }, { status: 403 });
  if (parsed.data.client_id && parsed.data.client_id !== principal.id) {
    return NextResponse.json({ error: 'Cliente da reserva não pertence à sessão' }, { status: 403 });
  }

  try {
    const batchId = randomUUID();
    const entries: Array<{ agenda_id: string; client_ids: string[] }> = [];
    const pendingInvites = new Map<string, { name: string; token: string }>();
    for (const item of items) {
      const participants = [principal.id];
      for (const dependent of item.dependents || []) {
        if ((item.dependents?.length || 0) > 15) throw new Error('Limite de acompanhantes excedido');
        const resolved = await resolveDependent(supabase, dependent);
        participants.push(resolved.id);
        if (resolved.needsCompletion && !pendingInvites.has(resolved.id)) {
          pendingInvites.set(resolved.id, { name: resolved.name, token: randomBytes(32).toString('base64url') });
        }
      }
      entries.push({ agenda_id: item.agendaId!, client_ids: participants });
    }

    const { data: reservationIds, error: batchError } = await supabase.rpc('create_pending_reservation_batch', {
      p_owner_id: principal.id,
      p_batch_id: batchId,
      p_entries: entries,
    });
    if (batchError) throw batchError;
    const { data: reservations, error: reservationError } = await supabase.from('reservas').select('*').in('id', reservationIds || []);
    if (reservationError || !reservations?.length) throw reservationError || new Error('Reservas não foram criadas');

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const inviteRows = [...pendingInvites].map(([clientId, invite]) => ({
      client_id: clientId,
      owner_id: principal.id,
      token_hash: hashToken(invite.token),
      expires_at: expiresAt,
    }));
    if (inviteRows.length) {
      const { error: inviteError } = await supabase.from('dependent_registration_invites').insert(inviteRows);
      if (inviteError) throw inviteError;
    }

    await supabase.from('audit_logs').insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: 'reservation.create',
      resource_type: 'reservation_batch',
      metadata: { batchId, reservationIds: reservations.map((item) => item.id) },
    });
    return NextResponse.json({
      success: true,
      reservas: reservations,
      invitations: [...pendingInvites.values()],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Falha ao reservar vagas' }, { status: 400 });
  }
}

async function resolveDependent(supabase: ReturnType<typeof createSupabaseAdmin>, input: DependentInput) {
  const cpfDigits = String(input.cpf || '').replace(/\D/g, '');
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim();
  if (cpfDigits.length !== 11 || name.length < 3 || phone.replace(/\D/g, '').length < 10) {
    throw new Error('Dados de acompanhante inválidos');
  }
  const cpf = cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const { data: existing } = await supabase.from('clients')
    .select('id, full_name, rg, birth_date, emergency_contact_name, accepted_terms_at')
    .eq('cpf', cpf).maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      name: existing.full_name || name,
      needsCompletion: !existing.rg || !existing.birth_date || !existing.emergency_contact_name || !existing.accepted_terms_at,
    };
  }
  const { data, error } = await supabase.from('clients').insert({ full_name: name, cpf, phone }).select('id, full_name').single();
  if (error) throw error;
  return { id: data.id, name: data.full_name, needsCompletion: true };
}

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
