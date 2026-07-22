import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getAdventureProgress } from '@/lib/gamification';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const supabase = createSupabaseAdmin();
  let { data: me } = await supabase.from('clients').select('id, pontos, experiencia').eq('auth_user_id', auth.user.id).maybeSingle();
  if (!me && auth.user.email) {
    const result = await supabase.from('clients').select('id, pontos, experiencia').ilike('email', auth.user.email).limit(1).maybeSingle();
    me = result.data;
  }
  if (!me) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });

  const { data: topUsers, error } = await supabase.from('clients')
    .select('id, full_name, pontos, experiencia')
    .order('experiencia', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: 'Falha ao carregar ranking' }, { status: 500 });

  const myPoints = Number(me.pontos || 0);
  const myExperience = Number(me.experiencia || 0);
  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).gt('experiencia', myExperience);
  return NextResponse.json({
    ranking: (topUsers || []).map((client, index) => ({
      position: index + 1,
      name: publicName(client.full_name),
      points: Number(client.pontos || 0),
      experience: Number(client.experiencia || 0),
      level: getAdventureProgress(Number(client.experiencia || 0)).current.name,
      isMe: client.id === me.id,
    })),
    myPosition: (count || 0) + 1,
    myPoints,
    myExperience,
    myLevel: getAdventureProgress(myExperience).current.name,
  });
}

function publicName(fullName: string | null) {
  const parts = String(fullName || 'Aventureiro').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)?.charAt(0)}.`;
}
