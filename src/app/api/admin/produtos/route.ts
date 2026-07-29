import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

// GET - Listar produtos
export async function GET() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { data, error } = await createSupabaseAdmin().from('produtos').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Falha ao listar produtos:', error);
    return NextResponse.json({ error: 'Não foi possível listar os produtos' }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST - Criar produto
export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<any>(request, 50_000);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const { name, category, price, stock, image } = body;
    
    if (!name || price <= 0) return NextResponse.json({ error: 'Nome e preço são obrigatórios' }, { status: 400 });
    
    const { data, error } = await createSupabaseAdmin().from('produtos').insert([{
      name, category: category || 'Equipamentos', price: Number(price), stock: Number(stock) || 0, image: image || ''
    }]).select().single();
    
    if (error) {
      console.error('Falha ao criar produto:', error);
      return NextResponse.json({ error: 'Não foi possível criar o produto' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Falha ao criar produto:', error);
    return NextResponse.json({ error: 'Não foi possível criar o produto' }, { status: 500 });
  }
}

// PUT - Editar produto
export async function PUT(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<any>(request, 50_000);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const { id, name, category, price, stock, image } = body;
    
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    
    const { data, error } = await createSupabaseAdmin().from('produtos').update({
      name, category, price: Number(price), stock: Number(stock), image
    }).eq('id', id).select().single();
    
    if (error) {
      console.error('Falha ao atualizar produto:', error);
      return NextResponse.json({ error: 'Não foi possível atualizar o produto' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Falha ao atualizar produto:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o produto' }, { status: 500 });
  }
}

// DELETE - Excluir produto
export async function DELETE(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    
    const { error } = await createSupabaseAdmin().from('produtos').delete().eq('id', id);
    if (error) {
      console.error('Falha ao excluir produto:', error);
      return NextResponse.json(
        {
          error: error.code === '23503'
            ? 'Este produto possui vendas registradas e não pode ser excluído'
            : 'Não foi possível excluir o produto',
          code: error.code,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Falha ao excluir produto:', error);
    return NextResponse.json({ error: 'Não foi possível excluir o produto' }, { status: 500 });
  }
}
