import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<any>(request, 100_000);
    if (parsed.response) return parsed.response;
    const data = parsed.data;
    const { client, agenda } = data;

    if (!client || !client.email || !agenda) {
      return NextResponse.json({ success: false, error: 'Dados insuficientes para enviar email.' }, { status: 400 });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Credenciais de email não configuradas.' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const firstName = client.full_name.split(' ')[0];
    const eventDateObj = new Date(agenda.date + 'T12:00:00Z');
    const eventDate = eventDateObj.toLocaleDateString('pt-BR');

    // E-mail para o CLiente
    const clientMailOptions = {
      from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
      to: client.email,
      subject: `Reserva Confirmada: ${agenda.title} 🌿`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #25D366; color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Reserva Confirmada! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Sua vaga para ${agenda.title} está garantida.</p>
          </div>
          
          <div style="padding: 30px 20px; color: #333; line-height: 1.6;">
            <p>Olá <strong>${firstName}</strong>,</p>
            <p>Obrigado por se aventurar com a gente! O seu pagamento foi aprovado com sucesso. Confira abaixo os detalhes da sua próxima trilha:</p>
            
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #F17B37; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #113a5d;">📋 Detalhes da Aventura</h3>
              <ul style="padding-left: 20px; margin-bottom: 0;">
                <li><strong>Trilha:</strong> ${agenda.title}</li>
                <li><strong>Data:</strong> ${eventDate}</li>
                <li><strong>Local de Encontro:</strong> ${agenda.meeting_point}</li>
                ${agenda.duration_hours ? `<li><strong>Duração:</strong> Aprox. ${agenda.duration_hours}h</li>` : ''}
                ${agenda.distance_km ? `<li><strong>Percurso:</strong> ${agenda.distance_km} km</li>` : ''}
                ${agenda.difficulty ? `<li><strong>Nível:</strong> ${agenda.difficulty === 'easy' ? 'Fácil' : agenda.difficulty === 'hard' ? 'Difícil' : 'Média'}</li>` : ''}
              </ul>
            </div>

            <h3 style="color: #113a5d; margin-top: 30px;">🎒 O que vestir e o que levar?</h3>
            <div style="background-color: #fff3ed; padding: 20px; border-radius: 8px; font-size: 14px;">
              <ul style="padding-left: 20px; line-height: 1.5;">
                <li><strong>Vestuário:</strong> Roupas leves e confortáveis (nada de jeans!), calçado fechado (tênis ou bota de trilha com boa aderência), boné/chapéu e óculos de sol.</li>
                <li><strong>Alimentação:</strong> Leve lanches práticos e rápidos (sanduíches naturais, frutas, barrinhas de cereal/proteína, castanhas).</li>
                <li><strong>Hidratação:</strong> Pelo menos 2 litros de água por pessoa. É melhor sobrar do que faltar!</li>
                <li><strong>Outros:</strong> Protetor solar, repelente, sacola para recolher seu lixo, e qualquer medicação de uso pessoal.</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px;">Lembre-se: em caso de dúvidas, nossa equipe está sempre à disposição no WhatsApp. Em breve criaremos o grupo da trilha para enviar mais atualizações!</p>
            
            <p style="margin-top: 30px;">Um grande abraço,<br/><strong>Equipe Mais Trilha Menos Estresse</strong></p>
          </div>
          
          <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #888;">
            Este é um e-mail automático. Por favor, não responda diretamente.
          </div>
        </div>
      `
    };

    // E-mail para os Administradores
    const adminMailOptions = {
      from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
      to: 'niveamariamagalhaes28@gmail.com', // E-mail da administradora
      subject: `💰 Nova Venda Confirmada: ${agenda.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #25D366;">Pagamento Confirmado!</h2>
          <p>O cliente <strong>${client.full_name}</strong> acabou de comprar uma vaga para <strong>${agenda.title}</strong>.</p>
          <ul>
            <li><strong>Data da Trilha:</strong> ${eventDate}</li>
            <li><strong>Email do Cliente:</strong> ${client.email}</li>
            <li><strong>Telefone:</strong> ${client.phone}</li>
          </ul>
          <p>Acesse o painel para ver mais detalhes.</p>
        </div>
      `
    };

    await transporter.sendMail(clientMailOptions);
    // Envia o e-mail do admin de forma "não bloqueante" para não atrasar a resposta
    transporter.sendMail(adminMailOptions).catch(e => console.error("Erro email admin", e));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro ao enviar e-mail de compra:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
