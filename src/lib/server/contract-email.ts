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
  const safeUrl = escapeHtml(input.signingUrl);
  const expires = new Date(input.expiresAt).toLocaleString("pt-BR");

  await transporter.sendMail({
    from: `Mais Trilha Menos Estresse <${requireServerEnv("GMAIL_USER")}>`,
    to: input.email,
    subject: "Acesse seus contratos da Mais Trilha",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172033">
        <div style="background:#071829;color:#fff;padding:28px;border-radius:18px 18px 0 0">
          <h1 style="margin:0;font-size:22px">Seus termos e contratos</h1>
        </div>
        <div style="border:1px solid #dfe7ef;border-top:0;padding:28px;border-radius:0 0 18px 18px">
          <p>Olá, <strong>${firstName}</strong>.</p>
          <p>Recebemos uma solicitação para consultar ou atualizar seus contratos da Mais Trilha Menos Estresse.</p>
          <p style="margin:26px 0">
            <a href="${safeUrl}" style="display:inline-block;background:#D96224;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">
              Abrir meus contratos
            </a>
          </p>
          <p style="font-size:13px;color:#657084">Este acesso é pessoal e expira em ${escapeHtml(expires)}. Não encaminhe este e-mail.</p>
          <p style="font-size:12px;color:#8a94a3">Se você não solicitou este acesso, ignore esta mensagem.</p>
        </div>
      </div>
    `,
  });
}

export async function sendContractRegistrationInviteEmail(input: {
  email: string;
  registrationUrl: string;
}) {
  const safeEmail = escapeHtml(input.email);
  const safeUrl = escapeHtml(input.registrationUrl);

  await createTransporter().sendMail({
    from: `Mais Trilha Menos Estresse <${requireServerEnv("GMAIL_USER")}>`,
    to: input.email,
    subject: "Faça seu cadastro para assinar os contratos da Mais Trilha",
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
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033">
        <div style="background:linear-gradient(135deg,#071829,#12385E);color:#fff;padding:30px;border-radius:20px 20px 0 0">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#F9C784">Mais Trilha Menos Estresse</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25">Primeiro, conclua seu cadastro</h1>
        </div>
        <div style="border:1px solid #dfe7ef;border-top:0;padding:28px;border-radius:0 0 20px 20px;background:#fff">
          <p>Olá!</p>
          <p>Não encontramos um cadastro concluído para <strong>${safeEmail}</strong>. Para acessar e assinar seus contratos, siga este passo a passo:</p>

          <div style="margin:24px 0">
            ${tutorialStep("1", "Abra o cadastro", "Use o botão abaixo; seu e-mail já estará preenchido.")}
            ${tutorialStep("2", "Preencha seus dados", "Informe os dados pessoais, contato de emergência e informações necessárias à atividade.")}
            ${tutorialStep("3", "Leia e assine", "Revise os termos, o contrato de responsabilidade e o contrato do seguro antes de assinar.")}
            ${tutorialStep("4", "Finalize", "Ao concluir, seu cadastro e as assinaturas serão registrados e você receberá as cópias por e-mail.")}
          </div>

          <p style="margin:28px 0;text-align:center">
            <a href="${safeUrl}" style="display:inline-block;background:#D96224;color:#fff;text-decoration:none;font-weight:700;padding:15px 24px;border-radius:12px">
              Fazer meu cadastro
            </a>
          </p>

          <div style="background:#f4f7fa;border-radius:12px;padding:14px;font-size:12px;line-height:1.5;color:#657084">
            Por segurança, não encaminhe este e-mail. Se você já fez o cadastro com outro endereço, volte à página de contratos e informe aquele e-mail.
          </div>
          <p style="margin-top:18px;font-size:12px;color:#8a94a3">Se você não solicitou esta mensagem, ignore-a.</p>
        </div>
      </div>
    `,
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
    subject: "Cópia dos seus contratos assinados",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172033">
        <div style="background:#071829;color:#fff;padding:28px;border-radius:18px 18px 0 0">
          <h1 style="margin:0;font-size:22px">Documentos assinados com sucesso</h1>
        </div>
        <div style="border:1px solid #dfe7ef;border-top:0;padding:28px;border-radius:0 0 18px 18px">
          <p>Olá, <strong>${firstName}</strong>.</p>
          <p>Sua assinatura eletrônica foi registrada. As cópias em PDF dos documentos assinados estão anexadas a este e-mail.</p>
          <p style="font-size:13px;color:#657084">Guarde esta mensagem para consultas futuras.</p>
        </div>
      </div>
    `,
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

function tutorialStep(number: string, title: string, text: string) {
  return `
    <div style="display:flex;gap:12px;margin:0 0 14px;padding:14px;border:1px solid #e6ebf0;border-radius:14px">
      <div style="width:30px;height:30px;line-height:30px;flex:0 0 30px;text-align:center;border-radius:50%;background:#0B2540;color:#fff;font-size:13px;font-weight:700">${escapeHtml(number)}</div>
      <div>
        <div style="font-size:14px;font-weight:700;color:#172033">${escapeHtml(title)}</div>
        <div style="margin-top:3px;font-size:12px;line-height:1.5;color:#657084">${escapeHtml(text)}</div>
      </div>
    </div>
  `;
}
