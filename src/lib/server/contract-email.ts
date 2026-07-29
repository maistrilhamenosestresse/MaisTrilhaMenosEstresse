import "server-only";

import nodemailer from "nodemailer";
import { generateContractPdf } from "@/lib/server/contract-pdf";
import { requireServerEnv } from "@/lib/server/env";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type ContractEmailClient = {
  id: string;
  full_name: string;
  email?: string | null;
};

export async function sendContractAccessEmail(input: {
  email: string;
  fullName: string;
  signingUrl: string;
  expiresAt: string;
}) {
  const transporter = createTransporter();
  const firstName = escapeHtml(input.fullName.split(/\s+/)[0] || "participante");
  const expires = new Date(input.expiresAt).toLocaleString("pt-BR");

  await transporter.sendMail({
    from: `Mais Trilha Menos Estresse <${requireServerEnv("GMAIL_USER")}>`,
    to: input.email,
    subject: "Seu acesso seguro aos contratos | Mais Trilha",
    text: [
      `Olá, ${input.fullName.split(/\s+/)[0] || "participante"}!`,
      "",
      "Seu acesso seguro aos contratos da Mais Trilha está pronto.",
      `O link expira em ${expires}.`,
      "",
      input.signingUrl,
      "",
      "Não encaminhe este link. Se você não fez a solicitação, ignore esta mensagem.",
    ].join("\n"),
    html: emailDocument({
      preheader: `Seu link pessoal para consultar e atualizar os contratos expira em ${expires}.`,
      eyebrow: "Acesso seguro",
      title: "Seus contratos estão prontos",
      body: `
        <p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:#263748">Olá, <strong>${firstName}</strong>!</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#536577">
          Recebemos sua solicitação para consultar ou atualizar os contratos da Mais Trilha Menos Estresse.
        </p>
        ${emailNotice("Acesso pessoal", `Este link expira em ${escapeHtml(expires)} e funciona somente para esta solicitação.`)}
        ${emailButton(input.signingUrl, "Abrir meus contratos")}
        ${emailFallbackLink(input.signingUrl)}
      `,
      footer: "Se você não solicitou este acesso, ignore a mensagem. Nenhuma alteração será realizada.",
    }),
  });
}

export async function sendContractRegistrationInviteEmail(input: {
  email: string;
  registrationUrl: string;
}) {
  const safeEmail = escapeHtml(input.email);

  await createTransporter().sendMail({
    from: `Mais Trilha Menos Estresse <${requireServerEnv("GMAIL_USER")}>`,
    to: input.email,
    subject: "Complete seu cadastro e assine os contratos | Mais Trilha",
    text: [
      "Olá!",
      "",
      "Não encontramos um cadastro concluído para este e-mail.",
      "Para consultar e assinar seus contratos da Mais Trilha Menos Estresse:",
      "1. Abra o link de cadastro.",
      "2. Confira seu e-mail e preencha seus dados.",
      "3. Leia os termos, o contrato de responsabilidade e o contrato do seguro.",
      "4. Assine e finalize o cadastro. Depois, você receberá as cópias por e-mail.",
      "",
      input.registrationUrl,
      "",
      "Se você não solicitou esta mensagem, pode ignorá-la.",
    ].join("\n"),
    html: emailDocument({
      preheader: "Seu cadastro ainda não foi concluído. Leva poucos minutos para preencher, revisar e assinar.",
      eyebrow: "Próximo passo",
      title: "Complete seu cadastro para assinar",
      body: `
        <p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:#263748">Olá!</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#536577">
          Ainda não encontramos um cadastro concluído para o endereço abaixo. O processo reúne seus
          dados essenciais, o contrato de responsabilidade e o documento do seguro em uma única jornada.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0">
          <tr>
            <td style="border:1px solid #dfe7ef;background:#f6f8fb;border-radius:12px;padding:13px 16px">
              <div style="font-size:10px;line-height:1.3;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#77889a">E-mail solicitado</div>
              <div style="margin-top:4px;font-size:14px;line-height:1.5;font-weight:700;color:#172b3d;word-break:break-all">${safeEmail}</div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px">
          ${emailStep("1", "Confira seus dados", "O e-mail já estará preenchido e poderá ser corrigido antes de continuar.")}
          ${emailStep("2", "Complete a ficha", "Informe contato, dados pessoais e as informações necessárias para a atividade.")}
          ${emailStep("3", "Leia com atenção", "Revise o contrato de responsabilidade e o documento do seguro.")}
          ${emailStep("4", "Assine e finalize", "As cópias assinadas serão enviadas ao seu e-mail após a conclusão.")}
        </table>
        ${emailButton(input.registrationUrl, "Começar meu cadastro")}
        ${emailFallbackLink(input.registrationUrl)}
        ${emailNotice("Importante", "Use seu e-mail principal. Se o endereço preenchido não estiver correto, altere-o na primeira etapa antes de enviar.")}
      `,
      footer: "Você recebeu esta mensagem porque alguém solicitou contratos usando este e-mail. Se não foi você, ignore-a com segurança.",
    }),
  });
}

export async function sendSignedContractsEmail(
  client: ContractEmailClient,
  contractIds: string[],
) {
  const email = String(client.email || "").trim().toLowerCase();
  if (!email || !contractIds.length) return false;

  const { data: contracts, error } = await createSupabaseAdmin()
    .from("client_contracts")
    .select("id, contract_type, version, title, signed_at, signature_url, document_hash, document_snapshot")
    .eq("client_id", client.id)
    .in("id", contractIds);
  if (error) throw error;
  if (!contracts?.length) return false;

  const attachments = await Promise.all(contracts.map(async (contract) => {
    const pdf = await generateContractPdf(contract);
    const typeName = contract.contract_type === "insurance" ? "seguro" : "responsabilidade";
    return {
      filename: `${typeName}-v${safeFileName(contract.version)}.pdf`,
      content: Buffer.from(pdf),
      contentType: "application/pdf",
    };
  }));

  const firstName = escapeHtml(client.full_name.split(/\s+/)[0] || "participante");
  await createTransporter().sendMail({
    from: `Mais Trilha Menos Estresse <${requireServerEnv("GMAIL_USER")}>`,
    to: email,
    subject: "Seus contratos assinados estão anexados | Mais Trilha",
    text: [
      `Olá, ${client.full_name.split(/\s+/)[0] || "participante"}!`,
      "",
      "Sua assinatura eletrônica foi registrada com sucesso.",
      "As cópias em PDF dos contratos assinados estão anexadas a esta mensagem.",
      "",
      "Guarde este e-mail para consultas futuras.",
    ].join("\n"),
    html: emailDocument({
      preheader: "Assinatura registrada. Suas cópias em PDF estão anexadas a esta mensagem.",
      eyebrow: "Documentos concluídos",
      title: "Assinatura registrada com sucesso",
      body: `
        <p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:#263748">Olá, <strong>${firstName}</strong>!</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#536577">
          Seus documentos foram assinados eletronicamente e as cópias em PDF seguem anexadas a esta mensagem.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0">
          <tr>
            <td width="48%" valign="top" style="border:1px solid #dfe7ef;border-radius:12px;padding:16px">
              <div style="font-size:22px;line-height:1">✓</div>
              <div style="margin-top:8px;font-size:13px;font-weight:700;color:#172b3d">Responsabilidade</div>
              <div style="margin-top:4px;font-size:11px;color:#77889a">PDF assinado anexado</div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="border:1px solid #dfe7ef;border-radius:12px;padding:16px">
              <div style="font-size:22px;line-height:1">✓</div>
              <div style="margin-top:8px;font-size:13px;font-weight:700;color:#172b3d">Seguro</div>
              <div style="margin-top:4px;font-size:11px;color:#77889a">PDF assinado anexado</div>
            </td>
          </tr>
        </table>
        ${emailNotice("Guarde esta mensagem", "Os anexos são sua cópia dos documentos assinados e podem ser consultados a qualquer momento.")}
      `,
      footer: "Em caso de dúvida sobre os documentos, responda a este e-mail ou fale pelos canais oficiais da Mais Trilha.",
    }),
    attachments,
  });
  return true;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: requireServerEnv("GMAIL_USER"),
      pass: requireServerEnv("GMAIL_APP_PASSWORD"),
    },
  });
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFileName(value: string) {
  return String(value || "atual").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function emailDocument(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  footer: string;
}) {
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>${escapeHtml(input.title)}</title>
        <style>
          body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          table { border-collapse: separate; }
          @media only screen and (max-width: 640px) {
            .mt-shell { width: 100% !important; }
            .mt-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .mt-title { font-size: 27px !important; line-height: 1.16 !important; }
            .mt-button, .mt-button a { display: block !important; width: 100% !important; box-sizing: border-box !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#eef2f5;font-family:Arial,Helvetica,sans-serif;color:#172b3d">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f5">
          <tr>
            <td align="center" style="padding:24px 12px">
              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" class="mt-shell" style="width:620px;max-width:620px">
                <tr>
                  <td style="height:5px;background:#D96224;border-radius:20px 20px 0 0;font-size:0;line-height:0">&nbsp;</td>
                </tr>
                <tr>
                  <td class="mt-pad" style="background:#071829;padding:34px 36px 30px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td>
                          <div style="font-size:10px;line-height:1.3;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F5B589">Mais Trilha Menos Estresse</div>
                          <div style="margin-top:16px;display:inline-block;border:1px solid #ffffff24;border-radius:999px;padding:7px 11px;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c8d8e5">${escapeHtml(input.eyebrow)}</div>
                          <h1 class="mt-title" style="margin:15px 0 0;font-size:32px;line-height:1.15;letter-spacing:-0.7px;color:#ffffff">${escapeHtml(input.title)}</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="mt-pad" style="background:#ffffff;padding:32px 36px 28px">
                    ${input.body}
                  </td>
                </tr>
                <tr>
                  <td class="mt-pad" style="background:#f7f9fb;border-top:1px solid #e5ebf0;border-radius:0 0 20px 20px;padding:20px 36px 24px">
                    <p style="margin:0;font-size:11px;line-height:1.6;color:#7b8b99">${escapeHtml(input.footer)}</p>
                    <p style="margin:12px 0 0;font-size:10px;line-height:1.5;color:#9aa7b3">
                      © ${new Date().getFullYear()} Mais Trilha Menos Estresse · Comunicação transacional
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function emailButton(url: string, label: string) {
  const safeUrl = escapeHtml(url);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 18px">
      <tr>
        <td align="center" class="mt-button" style="border-radius:12px;background:#D96224">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 26px;font-size:14px;line-height:1.3;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>
  `;
}

function emailFallbackLink(url: string) {
  const safeUrl = escapeHtml(url);
  return `
    <div style="margin:0 0 22px;font-size:11px;line-height:1.55;color:#7b8b99">
      Se o botão não abrir, copie e cole este endereço no navegador:<br>
      <a href="${safeUrl}" style="color:#315d7d;text-decoration:underline;word-break:break-all">${safeUrl}</a>
    </div>
  `;
}

function emailNotice(title: string, text: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0">
      <tr>
        <td style="border-left:4px solid #D96224;background:#fff5ed;border-radius:0 12px 12px 0;padding:14px 16px">
          <div style="font-size:12px;line-height:1.4;font-weight:700;color:#8b3d19">${escapeHtml(title)}</div>
          <div style="margin-top:4px;font-size:12px;line-height:1.55;color:#6d5549">${escapeHtml(text)}</div>
        </td>
      </tr>
    </table>
  `;
}

function emailStep(number: string, title: string, text: string) {
  return `
    <tr>
      <td width="42" valign="top" style="padding:7px 10px 7px 0">
        <div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background:#0B2540;color:#ffffff;font-size:12px;font-weight:700">${escapeHtml(number)}</div>
      </td>
      <td valign="top" style="padding:7px 0">
        <div style="font-size:13px;line-height:1.4;font-weight:700;color:#172b3d">${escapeHtml(title)}</div>
        <div style="margin-top:3px;font-size:12px;line-height:1.55;color:#657789">${escapeHtml(text)}</div>
      </td>
    </tr>
  `;
}
