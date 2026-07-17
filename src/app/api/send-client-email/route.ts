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
    const { client } = data;

    if (!client || !client.email) {
      return NextResponse.json({ success: false, error: 'Email do cliente não informado.' }, { status: 400 });
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
    const termoUrl = `https://www.maistrilhasmenosestresse.com/termo/${client.id}`;

    const mailOptions = {
      from: `Mais Trilha Menos Estresse <${process.env.GMAIL_USER}>`,
      to: client.email,
      subject: `Inscrição Confirmada, ${firstName}! Prepare a mochila 🎒`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #F17B37; color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Bem-vindo(a) à Mais Trilha!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Sua inscrição foi recebida com sucesso.</p>
          </div>
          
          <div style="padding: 30px 20px; color: #333; line-height: 1.6;">
            <p>Olá <strong>${firstName}</strong>,</p>
            <p>Parabéns! Nós recebemos o seu cadastro e a sua assinatura do <strong>Termo de Responsabilidade e Assunção de Riscos</strong>.</p>
            
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #F17B37; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #113a5d;">Cópia do Seu Contrato de Autorização</h3>
              <p style="margin-bottom: 0;">Você pode acessar, salvar ou imprimir uma cópia do seu termo assinado digitalmente a qualquer momento clicando no botão abaixo:</p>
              <br/>
              <a href="${termoUrl}" style="background-color: #113a5d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acessar Meu Contrato Assinado</a>
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

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro ao enviar e-mail para o cliente:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
