import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'Asaas API Key não configurada.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || 'payments';
  if (!isAllowedEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Endpoint Asaas não permitido.' }, { status: 400 });
  }
  
  // Ex: ?endpoint=payments&status=OVERDUE
  const queryParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      queryParams.append(key, value);
    }
  });

  try {
    const url = `${ASAAS_API_URL}/${endpoint}?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'MaisTrilha/1.0 (Next.js)',
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(`Erro na API do Asaas: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro na proxy Asaas (GET):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'Asaas API Key não configurada.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint não especificado.' }, { status: 400 });
  }
  if (!isAllowedEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Endpoint Asaas não permitido.' }, { status: 400 });
  }

  try {
    const parsed = await readJsonBody<Record<string, unknown>>(request, 100_000);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const url = `${ASAAS_API_URL}/${endpoint}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'MaisTrilha/1.0 (Next.js)',
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(`Erro na API do Asaas: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro na proxy Asaas (POST):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function isAllowedEndpoint(endpoint: string) {
  return /^(payments|customers|financialTransactions|finance\/balance|anticipations)(\/[A-Za-z0-9_-]+)?$/.test(endpoint);
}
