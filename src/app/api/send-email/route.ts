import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { verifyRegistrationNotification } from '@/lib/server/registration-notification';
import { getAdminEmails } from '@/lib/server/env';

export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody<any>(request);
    if (parsed.response) return parsed.response;
    const data = parsed.data;

    const internalSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isInternal = !!process.env.CRON_SECRET && internalSecret === process.env.CRON_SECRET;
    if (data.type === 'new_registration') {
      const originError = assertSameOrigin(request);
      if (originError) return originError;
      const clientId = String(data.clientId || '');
      const notificationToken = String(data.notificationToken || '');
      if (!/^[0-9a-f-]{36}$/i.test(clientId) || !verifyRegistrationNotification(clientId, notificationToken)) {
        return NextResponse.json({ error: 'Comprovante de cadastro inválido' }, { status: 403 });
      }
      const { data: client } = await createSupabaseAdmin().from('clients').select('*').eq('id', clientId).single();
      if (!client) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
      data.client = client;
    } else if (!isInternal) {
      const auth = await requireAdminUser();
      if (auth.response) return auth.response;
    }
    
    // Configuração do transporter (usa variáveis de ambiente)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    let mailOptions = {};

    if (data.type === 'new_registration') {
      const { client } = data;
      const origin = configuredSiteOrigin(request);
      const safeClient = {
        full_name: escapeHtml(client.full_name),
        cpf: escapeHtml(client.cpf),
        rg: escapeHtml(client.rg),
        birth_date: escapeHtml(client.birth_date),
        phone: escapeHtml(client.phone),
        email: escapeHtml(client.email || 'Não informado'),
        emergency_contact_name: escapeHtml(client.emergency_contact_name),
        emergency_contact_phone: escapeHtml(client.emergency_contact_phone),
        health_notes: escapeHtml(client.health_notes),
        photo_url: safeHttpsUrl(client.photo_url),
      };
      const contractsUrl = `${origin}/termo/${encodeURIComponent(client.id)}`;
      
      // Email para Admin
      const adminMailOptions = {
        from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
        to: getAdminEmails().join(', '),
        subject: `Novo Cadastro Realizado: ${safeMailHeader(client.full_name)}`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #F17B37; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0;">Nova Ficha Recebida!</h2>
              <p style="margin: 5px 0 0 0;">Um aventureiro acabou de preencher os dados.</p>
            </div>
            <div style="padding: 20px;">
              ${safeClient.photo_url ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${escapeHtml(safeClient.photo_url)}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;" alt="Foto" /></div>` : ''}
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Nome:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.full_name}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>CPF:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.cpf}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>RG:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.rg}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Nascimento:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.birth_date}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Telefone:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.phone}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>E-mail:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.email}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Contato Emergência:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeClient.emergency_contact_name} (${safeClient.emergency_contact_phone})</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Notas de Saúde:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee; color: #d93025; font-weight: bold;">${safeClient.health_notes}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Uso de Imagem:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${client.image_authorization ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}</td></tr>
                ${client.id ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Contratos atuais:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="${escapeHtml(contractsUrl)}" style="color: #113a5d; font-weight: bold;">Acessar os dois documentos</a></td></tr>` : ''}
              </table>
            </div>
          </div>
        `
      };

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return NextResponse.json({ success: true, warning: 'E-mail não configurado' });
      }

      if (adminMailOptions.to) await transporter.sendMail(adminMailOptions);

      // Email para Cliente (cópia do contrato)
      if (client.email) {
        const firstName = escapeHtml(client.full_name.split(' ')[0]);
        const termoUrl = escapeHtml(contractsUrl);

        const clientMailOptions = {
          from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
          to: client.email,
          subject: `Inscrição Confirmada, ${firstName}! Prepare a mochila 🥾`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #F17B37; color: white; padding: 30px 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Bem-vindo(a) à Mais Trilha!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Sua inscrição foi recebida com sucesso.</p>
              </div>
              
              <div style="padding: 30px 20px; color: #333; line-height: 1.6;">
                <p>Olá <strong>${firstName}</strong>,</p>
                <p>Recebemos seu cadastro e as assinaturas do <strong>Termo de Responsabilidade</strong> e da <strong>Autorização do Seguro</strong>.</p>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #F17B37; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #113a5d;">Seus documentos atuais</h3>
                  <p style="margin-bottom: 0;">Acesse as duas versões assinadas digitalmente pelo botão abaixo:</p>
                  <br/>
                  <a href="${termoUrl}" style="background-color: #113a5d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acessar meus contratos assinados</a>
                </div>

                <h3 style="color: #113a5d; margin-top: 30px;">Resumo do Seguro Aventura Ativo 🛡️</h3>
                <p>Sua segurança é nossa prioridade. O seu Seguro Aventura estará ativo durante toda a atividade. Abaixo, você encontra o resumo das coberturas e procedimentos do seu seguro (Plano 2).</p>
                
                <div style="background-color: #eef5fa; padding: 20px; border-radius: 8px; font-size: 14px; margin-top: 15px;">
                  <h4 style="margin-top: 0; color: #113a5d;">Suas Coberturas:</h4>
                  <ul style="padding-left: 20px; margin-bottom: 20px; line-height: 1.5;">
                    <li><strong>Morte Acidental (MA):</strong> R$ 30.000,00</li>
                    <li><strong>Invalidez Permanente (IPA):</strong> R$ 30.000,00</li>
                    <li><strong>DMHO (Despesas Médicas):</strong> R$ 3.000,00</li>
                    <li><strong>Cobertura de Deslocamento:</strong> Garantida em todo território nacional de ida e volta.</li>
                  </ul>
                  
                  <h4 style="color: #113a5d;">Procedimentos em Caso de Acidente:</h4>
                  <ul style="padding-left: 20px; line-height: 1.5;">
                    <li><strong>Comunicação Imediata:</strong> Ocorrendo um acidente, comunique imediatamente o guia responsável pela atividade.</li>
                    <li><strong>Atendimento Médico:</strong> O primeiro atendimento deverá ocorrer no mesmo dia ou no máximo em até 5 dias.</li>
                    <li><strong>Documentação para Reembolso:</strong> Guarde nota fiscal (não aceitamos recibo), receita médica, laudo médico detalhado, foto no local, cópia de documento e comprovante bancário.</li>
                  </ul>
                </div>
                
                <br/>
                <p>Em breve, nossa equipe enviará as instruções detalhadas e horários no grupo oficial do WhatsApp. Fique atento!</p>
                
                <p style="margin-top: 30px;">Um grande abraço,<br/><strong>Equipe Mais Trilha Menos Estresse</strong></p>
              </div>
              
              <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                Este é um e-mail automático. Por favor, não responda diretamente.
              </div>
            </div>
          `
        };
        await transporter.sendMail(clientMailOptions);
      }

      return NextResponse.json({ success: true });
    }
    else if (data.type === 'birthday_reminder') {
      const { clients } = data;
      
      const clientsHtml = clients.map((c: any) => {
        const safeName = escapeHtml(c.full_name);
        const safePhone = escapeHtml(c.phone);
        const whatsappMsg = encodeURIComponent(`Oii ${c.full_name.split(' ')[0]}!! Passando aqui pra te desejar um Feliz Aniversário! 🎉🥳 Que você tenha um dia incrível, cheio de alegrias e que a gente possa comemorar em muitas trilhas juntos! Um abraço da equipe Mais Trilha Menos Estresse! 🥾⛰️`);
        const whatsappLink = `https://wa.me/55${c.phone.replace(/\D/g, '')}?text=${whatsappMsg}`;
        
        return `
          <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h3 style="margin: 0 0 5px 0; color: #333;">🎈 ${safeName}</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">Aniversário: ${escapeHtml(new Date(c.birth_date).toLocaleDateString('pt-BR'))} (Telefone: ${safePhone})</p>
            </div>
            <a href="${escapeHtml(whatsappLink)}" style="background-color: #25D366; color: white; text-decoration: none; padding: 10px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; display: inline-block;">
              Mandar WhatsApp
            </a>
          </div>
        `;
      }).join('');

      mailOptions = {
        from: `Aviso de Aniversários <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `🎉 Temos aniversariantes essa semana!`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
            <div style="background-color: #6228d7; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="margin: 0; text-align: center;">Aviso Automático de Aniversário</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #444;">Olá Administradora!</p>
              <p style="font-size: 16px; color: #444;">Os seguintes clientes estão comemorando aniversário nos próximos dias. Clique no botão verde para enviar uma mensagem carinhosa pelo WhatsApp:</p>
              
              <div style="margin-top: 30px;">
                ${clientsHtml}
              </div>
            </div>
          </div>
        `
      };
    } else if (data.type === 'security_log') {
      mailOptions = {
        from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
        to: data.to,
        subject: data.subject,
        text: data.text
      };
    } else if (data.to && data.subject) {
      // Caso genérico se enviar direto os campos básicos
      mailOptions = {
        from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html
      };
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn("Credenciais de E-mail não configuradas no .env.local");
      return NextResponse.json({ success: true, warning: 'E-mail não enviado por falta de credenciais' });
    }

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail' }, { status: 500 });
  }
}

function configuredSiteOrigin(request: Request) {
  const configured = String(
    process.env.NEXT_PUBLIC_BASE_URL
      || process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXTAUTH_URL
      || '',
  ).trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.hostname === 'localhost') return url.origin;
    } catch {
      // O fallback abaixo usa apenas a origem já validada pelo runtime.
    }
  }
  const requestUrl = new URL(request.url);
  return requestUrl.hostname === 'localhost'
    ? requestUrl.origin
    : 'https://www.maistrilhasmenosestresse.com';
}

function safeHttpsUrl(value: unknown) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function safeMailHeader(value: unknown) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
