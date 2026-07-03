import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { reserva_id, reserva_ids, agenda_id, agenda_title, price, customer, dependentCPFs } = await request.json();

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    let baseUrl = `${protocol}://${host}`;
    
    // Se por acaso pegou localhost mas tem uma ENV válida (não-localhost), usa a ENV
    if (baseUrl.includes('localhost') && process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    }

    const ids = reserva_ids || (reserva_id ? (reserva_id.includes(',') ? reserva_id.split(',') : [reserva_id]) : []);

    if (ids.length === 0 || !price) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // A API do InfinitePay espera o handle sem o $
    const infiniteTag = "nivea-maria-7en";
    
    // Para evitar o limite de 50 caracteres da InfinitePay no order_nsu,
    // geramos um ID de pedido curto e salvamos a relação de IDs na tabela notificacoes.
    const shortOrderId = `PEDIDO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const allIdsJoined = ids.join(',');

    try {
      await supabase.from('notificacoes').insert([{ 
        reserva_id: null,
        mensagem: `CHECKOUT_MAPPING: ${shortOrderId} -> ${allIdsJoined}`,
        lida: false
      }]);
    } catch (e) {
      console.error("Erro ao salvar mapping de checkout", e);
    }

    const depsQuery = (dependentCPFs && dependentCPFs.length > 0) ? `&deps=${dependentCPFs.join(',')}` : '';

    // Montando a requisição para a InfinitePay
    const payload = {
      handle: infiniteTag,
      redirect_url: `${baseUrl}/sucesso?agenda_id=${agenda_id || ids[0]}${depsQuery}`,
      webhook_url: process.env.INFINITEPAY_WEBHOOK_SECRET 
        ? `${baseUrl}/api/webhooks/infinitepay?token=${process.env.INFINITEPAY_WEBHOOK_SECRET}`
        : `${baseUrl}/api/webhooks/infinitepay`,
      order_nsu: shortOrderId,
      customer: customer,
      metadata: { reservas: ids },
      items: [
        {
          quantity: 1,
          price: Math.round(price * 100), // O preço deve ser enviado em centavos
          description: `Ingresso Trilha: ${agenda_title}`
        }
      ]
    };

    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Erro da InfinitePay:", result);
      return NextResponse.json({ error: 'Falha ao criar link de pagamento', details: result }, { status: response.status });
    }

    // O link de pagamento vem na propriedade 'url' (conforme documentação atual, costuma ser link_url ou apenas url)
    const paymentUrl = result.url || result.link_url || (result.data && result.data.url) || (result.data && result.data.link_url);

    if (!paymentUrl) {
      console.error("URL não retornada pela InfinitePay:", result);
      return NextResponse.json({ error: 'URL de pagamento não gerada' }, { status: 500 });
    }

    return NextResponse.json({ url: paymentUrl });

  } catch (error: any) {
    console.error("Erro no checkout:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
