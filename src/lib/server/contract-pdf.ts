import "server-only";

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { ContractSnapshot } from "@/lib/contracts";

type ContractRecord = {
  signed_at: string;
  signature_url: string;
  document_hash: string;
  document_snapshot: ContractSnapshot;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function generateContractPdf(contract: ContractRecord) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const snapshot = contract.document_snapshot;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawFooter(page, regular, contract.document_hash);
  };

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN + 24) addPage();
  };

  const drawWrapped = (
    text: string,
    options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {},
  ) => {
    const font = options.font || regular;
    const size = options.size || 10;
    const lineHeight = size * 1.45;
    const lines = wrapText(sanitizePdfText(text), font, size, TEXT_WIDTH);
    ensureSpace(lines.length * lineHeight + (options.gap || 0));
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font,
        color: options.color || rgb(0.16, 0.2, 0.26),
      });
      y -= lineHeight;
    }
    y -= options.gap || 0;
  };

  drawFooter(page, regular, contract.document_hash);
  drawWrapped("MAIS TRILHA MENOS ESTRESSE", {
    font: bold,
    size: 10,
    color: rgb(0.45, 0.25, 0.65),
    gap: 10,
  });
  drawWrapped(snapshot.title.toUpperCase(), {
    font: bold,
    size: 18,
    color: rgb(0.07, 0.12, 0.2),
    gap: 8,
  });
  drawWrapped(`Versão ${snapshot.version}`, {
    font: bold,
    size: 9,
    color: rgb(0.45, 0.48, 0.55),
    gap: 16,
  });
  drawWrapped(snapshot.intro, { size: 10, gap: 16 });

  const participant = snapshot.participant;
  ensureSpace(112);
  page.drawRectangle({
    x: MARGIN,
    y: y - 96,
    width: TEXT_WIDTH,
    height: 104,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.86, 0.88, 0.92),
    borderWidth: 1,
  });
  y -= 14;
  const participantLines = [
    `Participante: ${participant.fullName}`,
    `CPF: ${participant.cpf || "Não informado"}    RG: ${participant.rg || "Não informado"}`,
    `Nascimento: ${formatDate(participant.birthDate)}    Telefone: ${participant.phone || "Não informado"}`,
    `E-mail: ${participant.email || "Não informado"}`,
    `Emergência: ${participant.emergencyContactName || "Não informado"} - ${participant.emergencyContactPhone || "Não informado"}`,
  ];
  for (const line of participantLines) {
    page.drawText(sanitizePdfText(line), {
      x: MARGIN + 12,
      y,
      size: 9,
      font: regular,
      color: rgb(0.15, 0.18, 0.24),
    });
    y -= 16;
  }
  y -= 18;

  for (const section of snapshot.sections) {
    drawWrapped(section.title, {
      font: bold,
      size: 11,
      color: rgb(0.23, 0.12, 0.38),
      gap: 6,
    });
    for (const paragraph of section.paragraphs) {
      drawWrapped(paragraph, { size: 9.5, gap: 9 });
    }
    y -= 4;
  }

  drawWrapped(snapshot.acceptance, { font: bold, size: 10, gap: 18 });
  ensureSpace(170);
  page.drawText(`Assinado em ${new Date(contract.signed_at).toLocaleString("pt-BR")}`, {
    x: MARGIN,
    y,
    size: 9,
    font: regular,
    color: rgb(0.38, 0.4, 0.46),
  });
  y -= 18;

  const signature = await fetchSignature(contract.signature_url, pdf);
  if (signature) {
    const ratio = Math.min(180 / signature.width, 70 / signature.height, 1);
    page.drawImage(signature, {
      x: MARGIN,
      y: y - signature.height * ratio,
      width: signature.width * ratio,
      height: signature.height * ratio,
    });
    y -= signature.height * ratio + 8;
  } else {
    page.drawText("Assinatura eletrônica registrada no sistema", {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
      color: rgb(0.15, 0.18, 0.24),
    });
    y -= 24;
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 230, y },
    thickness: 1,
    color: rgb(0.2, 0.22, 0.26),
  });
  y -= 16;
  page.drawText(sanitizePdfText(participant.fullName), {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: rgb(0.15, 0.18, 0.24),
  });

  pdf.setTitle(snapshot.title);
  pdf.setAuthor("Mais Trilha Menos Estresse");
  pdf.setSubject(`Contrato ${snapshot.type} - versão ${snapshot.version}`);
  pdf.setCreationDate(new Date(contract.signed_at));
  return pdf.save();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, "");
}

function formatDate(value: string) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function drawFooter(page: PDFPage, font: PDFFont, hash: string) {
  page.drawText(`Documento eletrônico - hash ${String(hash || "").slice(0, 20)}`, {
    x: MARGIN,
    y: 24,
    size: 7,
    font,
    color: rgb(0.52, 0.54, 0.58),
  });
}

async function fetchSignature(url: string, pdf: PDFDocument) {
  if (!url || url.startsWith("ASSINATURA MANUAL")) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("png") || url.toLowerCase().includes(".png")) {
      return await pdf.embedPng(bytes);
    }
    return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
