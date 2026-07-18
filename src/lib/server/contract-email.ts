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
