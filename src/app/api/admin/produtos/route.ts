import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { requireServerEnv } from '@/lib/server/env';
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
    const normalizedImage = normalizeProductImage(image);
    
    if (!name || price <= 0) return NextResponse.json({ error: 'Nome e preço são obrigatórios' }, { status: 400 });
    
    const { data, error } = await createSupabaseAdmin().from('produtos').insert([{
      name, category: category || 'Equipamentos', price: Number(price), stock: Number(stock) || 0, image: normalizedImage
    }]).select().single();
    
    if (error) {
      console.error('Falha ao criar produto:', error);
      return NextResponse.json({ error: 'Não foi possível criar o produto' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ProductImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
    const normalizedImage = normalizeProductImage(image);
    
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    
    const { data, error } = await createSupabaseAdmin().from('produtos').update({
      name, category, price: Number(price), stock: Number(stock), image: normalizedImage
    }).eq('id', id).select().single();
    
    if (error) {
      console.error('Falha ao atualizar produto:', error);
      return NextResponse.json({ error: 'Não foi possível atualizar o produto' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ProductImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Falha ao atualizar produto:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o produto' }, { status: 500 });
  }
}

class ProductImageValidationError extends Error {}

function normalizeProductImage(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > 2_048) throw new ProductImageValidationError('URL de imagem inválida');

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new ProductImageValidationError('URL de imagem inválida');
  }
  const bucket = requireServerEnv('AWS_S3_BUCKET_NAME');
  const region = process.env.AWS_REGION || 'us-east-1';
  if (
    url.protocol !== 'https:'
    || url.hostname !== `${bucket}.s3.${region}.amazonaws.com`
  ) {
    throw new ProductImageValidationError('A imagem deve estar armazenada no AWS S3 oficial');
  }
  return url.toString();
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
