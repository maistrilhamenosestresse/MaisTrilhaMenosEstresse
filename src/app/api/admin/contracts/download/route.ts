import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { generateContractPdf } from "@/lib/server/contract-pdf";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const requestedType = url.searchParams.get("type");
  const requestedClientId = url.searchParams.get("clientId");
  if (requestedType && !["responsibility", "insurance"].includes(requestedType)) {
    return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("client_contracts")
    .select("id, client_id, contract_type, version, signed_at, signature_url, document_hash, document_snapshot")
    .order("signed_at", { ascending: false });
  if (requestedType) query = query.eq("contract_type", requestedType);
  if (requestedClientId) {
    if (!/^[0-9a-f-]{36}$/i.test(requestedClientId)) {
      return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
    }
    query = query.eq("client_id", requestedClientId);
  }
  const { data: contracts, error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível carregar os contratos" }, { status: 500 });
  if (!contracts?.length) {
    return NextResponse.json({ error: "Nenhum contrato versionado foi assinado ainda" }, { status: 404 });
  }

  const latest = new Map<string, any>();
  for (const contract of contracts) {
    const key = `${contract.client_id}:${contract.contract_type}`;
    if (!latest.has(key)) latest.set(key, contract);
  }

  const clientIds = [...new Set([...latest.values()].map((contract) => contract.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, cpf")
    .in("id", clientIds);
  const clientById = new Map((clients || []).map((client) => [client.id, client]));

  const zip = new JSZip();
  const manifest: string[] = [
    "cliente,cpf,tipo,versao,assinado_em,hash",
  ];

  for (const contract of latest.values()) {
    const client = clientById.get(contract.client_id);
    const name = safeFileName(client?.full_name || contract.document_snapshot?.participant?.fullName || "participante");
    const typeName = contract.contract_type === "insurance" ? "seguro" : "responsabilidade";
    const pdf = await generateContractPdf(contract);
    zip.file(`${name}/${typeName}-v${safeFileName(contract.version)}.pdf`, pdf);
    manifest.push([
      csvCell(client?.full_name || ""),
      csvCell(client?.cpf || ""),
      csvCell(contract.contract_type),
      csvCell(contract.version),
      csvCell(contract.signed_at),
      csvCell(contract.document_hash),
    ].join(","));
  }

  zip.file("manifesto.csv", `\uFEFF${manifest.join("\n")}`);
  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "contracts.bulk_download",
    resource_type: "client_contracts",
    metadata: {
      type: requestedType || "all",
      clientId: requestedClientId || null,
      contracts: latest.size,
      clients: clientIds.length,
    },
  });

  const archiveBody = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  return new Response(archiveBody, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="contratos-assinados-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function safeFileName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "participante";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
