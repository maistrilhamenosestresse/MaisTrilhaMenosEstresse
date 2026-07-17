import { NextResponse } from 'next/server';
import { sendWhatsAppText, sendWhatsAppImage } from '@/lib/whatsapp';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET(request: Request) {
  try {
    // SECURITY: Verifica o token do Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("Tentativa de disparo não autorizado no Cron de Aniversários.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    // 1. Busca todos os clientes
    const { data: clients, error } = await supabaseAdmin.from('clients').select('*');
    if (error) throw error;
    if (!clients || clients.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum cliente cadastrado' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.maistrilhasmenosestresse.com';
    let emailsSentToClients = 0;
    let notificationsCreated = 0;
    const upcomingBirthdays = [];

    for (const client of clients) {
      if (!client.birth_date) continue;
      
      const bDate = new Date(client.birth_date);
      bDate.setFullYear(today.getFullYear());
      
      if (bDate < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)) {
        bDate.setFullYear(today.getFullYear() + 1);
      }
      
      const diffTime = bDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 3 && diffDays >= 0) {
        upcomingBirthdays.push(client);
      }

      // Se o aniversário for HOJE, manda email e WhatsApp de parabéns direto pro cliente
      if (diffDays === 0) {
        if (client.email) {
          const clientHtml = `
            <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border-radius: 15px; overflow: hidden; border: 1px solid #eee; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #F17B37, #d96220); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Feliz Aniversário, ${client.full_name.split(' ')[0]}! 🎁</h1>
              </div>
              <div style="padding: 30px; background-color: #ffffff; text-align: center;">
                <p style="font-size: 18px; color: #444; line-height: 1.6;">
                  Hoje é um dia muito especial! A equipe da <strong>Mais Trilha Menos Estresse</strong> deseja que sua vida seja uma jornada repleta de saúde, paz, alegria e paisagens inesquecíveis!
                </p>
                <p style="font-size: 16px; color: #666; margin-top: 20px;">
                  Que o seu novo ano traga muitas aventuras e momentos incríveis. Esperamos você em nossa próxima trilha para comemorarmos juntos! 🥾⛰️
                </p>
                <div style="margin-top: 30px;">
                  <a href="https://wa.me/${String(process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, '')}" style="background-color: #25D366; color: white; text-decoration: none; padding: 12px 25px; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Falar com a equipe</a>
                </div>
              </div>
              <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #999; font-size: 12px;">
                Enviado com carinho por Mais Trilha Menos Estresse.
              </div>
            </div>
          `;
          
          await fetch(`${baseUrl}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
            body: JSON.stringify({
              to: client.email,
              subject: `🎉 Feliz Aniversário, ${client.full_name.split(' ')[0]}! - Mais Trilha Menos Estresse`,
              html: clientHtml
            })
          }).catch(e => console.error("Erro ao enviar email de parabéns", e));
          emailsSentToClients++;
        }

        // WhatsApp de Parabéns
        if (client.phone) {
          const zapBdayMsg = `Feliz Aniversário, *${client.full_name.split(' ')[0]}*! 🎁🎉\n\nHoje é um dia muito especial! A equipe da *Mais Trilha Menos Estresse* deseja que sua vida seja uma jornada repleta de saúde, paz, alegria e paisagens inesquecíveis!\n\nQue o seu novo ano traga muitas aventuras e momentos incríveis. Esperamos você em nossa próxima trilha para comemorarmos juntos! 🥾⛰️`;
          
          if (process.env.BIRTHDAY_IMAGE_URL) {
            await sendWhatsAppImage(client.phone, process.env.BIRTHDAY_IMAGE_URL, zapBdayMsg);
          } else {
            await sendWhatsAppText(client.phone, zapBdayMsg);
          }
        }
      }

      // Se o aniversário for AMANHÃ, registra notificação no painel admin e manda zap pro admin
      if (diffDays === 1) {
        const { error: supErr } = await supabaseAdmin.from('notificacoes').insert({
          tipo: 'aniversario',
          titulo: `Aviso de Aniversário 🎁`,
          mensagem: `${client.full_name} faz aniversário amanhã! Prepare os parabéns.`,
          lida: false
        });
        if (supErr) console.error("Erro ao registrar notificacao de aniversario", supErr);
        notificationsCreated++;

        const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER;
        if (adminNumber) {
          await sendWhatsAppText(adminNumber, `📅 *Lembrete de Aniversário*\n\nO cliente *${client.full_name}* faz aniversário amanhã!`);
        }
      }
    }

    if (upcomingBirthdays.length > 0) {
      await fetch(`${baseUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
        body: JSON.stringify({
          type: 'birthday_reminder',
          clients: upcomingBirthdays
        })
      });
    }

    return NextResponse.json({ 
      success: true, 
      notified: upcomingBirthdays.length,
      emailsSentToClients,
      notificationsCreated
    });
    
  } catch (error: any) {
    console.error('Erro no Cron Job de Aniversários:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
