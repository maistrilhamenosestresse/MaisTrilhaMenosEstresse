import type { Session } from "@supabase/supabase-js";
import type { TrailMeshMessage } from "@maistrilha/trail-core";
import { appConfig } from "./config";

export async function apiRequest<T>(
  session: Session,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${session.access_token}`,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha de comunicação (${response.status})`);
  return payload as T;
}

export function listOperations(session: Session) {
  return apiRequest<{ operations: Record<string, any>[]; availableAgendas?: Record<string, any>[] }>(
    session,
    "/api/operations",
  );
}

export function getOperation(session: Session, operationId: string) {
  return apiRequest<Record<string, any>>(session, `/api/operations/${operationId}`);
}

export function createOperation(session: Session, body: Record<string, unknown>) {
  return apiRequest<Record<string, any>>(session, "/api/operations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function joinOperation(
  session: Session,
  operationId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<Record<string, any>>(session, `/api/operations/${operationId}/join`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateOperation(
  session: Session,
  operationId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<Record<string, any>>(session, `/api/operations/${operationId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function syncOperation(
  session: Session,
  operationId: string,
  body: { deviceId: string; cursor?: string; events: TrailMeshMessage[] },
) {
  return apiRequest<{
    acceptedMessageIds: string[];
    rejected: Array<{ messageId?: string; reason: string }>;
    events: Record<string, any>[];
    memberDirectory: Record<string, string>;
    nextCursor: string;
  }>(session, `/api/operations/${operationId}/sync`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitReport(
  session: Session,
  operationId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<Record<string, any>>(session, `/api/operations/${operationId}/reports`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCurrentClient(session: Session) {
  return apiRequest<{ client: Record<string, any> }>(session, "/api/clients/me");
}

export function updateCurrentClient(session: Session, body: Record<string, unknown>) {
  return apiRequest<{ client: Record<string, any> }>(session, "/api/clients/me", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getPassport(session: Session) {
  return apiRequest<Record<string, any>>(session, "/api/app/passport");
}

export function getRanking(session: Session) {
  return apiRequest<Record<string, any>>(session, "/api/app/ranking");
}

export function getContracts(session: Session) {
  return apiRequest<Record<string, any>>(session, "/api/contracts");
}

export function signContract(
  session: Session,
  contractType: "responsibility" | "insurance",
  signatureUrl: string,
) {
  return apiRequest<Record<string, any>>(session, "/api/contracts", {
    method: "POST",
    body: JSON.stringify({
      contract_type: contractType,
      signature_url: signatureUrl,
    }),
  });
}

export function getAgendaAvailability(session: Session, agendaId: string) {
  return apiRequest<{ reserved: number; maxCapacity?: number; available?: number }>(
    session,
    `/api/agendas/${agendaId}/availability`,
  );
}

export function createReservation(
  session: Session,
  body: {
    client_id: string;
    agenda_id: string;
    checkout_source: "app";
  },
) {
  return apiRequest<{ reservas: Array<{ id: string }>; batchId?: string }>(
    session,
    "/api/create-reserva",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function checkoutTrail(
  session: Session,
  body: {
    reserva_ids: string[];
    payment_method: "INFINITEPAY" | "PIX" | "CREDIT_CARD" | "BOLETO";
    installments: number;
    checkout_source: "app";
    use_cashback: boolean;
    use_points: boolean;
    customer_data?: { postalCode?: string; addressNumber?: string };
  },
) {
  return apiRequest<Record<string, any>>(session, "/api/checkout-asaas", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function checkoutStore(
  session: Session,
  body: {
    produtoId: string;
    clientId: string;
    method: "infinitepay" | "boleto" | "cashback";
    forma_entrega: "retirada" | "correios" | "entrega_trilha";
    delivery_info: string;
  },
) {
  return apiRequest<Record<string, any>>(session, "/api/checkout-store", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rechargeWallet(
  session: Session,
  body: { amount: number; clientId: string; method: "infinitepay" | "pix" | "cartao" },
) {
  return apiRequest<Record<string, any>>(session, "/api/checkout-asaas/recarregar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAlbum(session: Session, agendaId: string) {
  return apiRequest<{ photos: Array<{ aws_url: string }> }>(
    session,
    `/api/album/${agendaId}`,
  );
}

export function uploadImage(session: Session, formData: FormData) {
  return apiRequest<{ publicUrl: string }>(session, "/api/upload/image", {
    method: "POST",
    body: formData,
  });
}

export function findAlbumFaces(session: Session, agendaId: string, imageBase64: string) {
  return apiRequest<{ matches: string[] }>(session, "/api/ai/find-faces", {
    method: "POST",
    body: JSON.stringify({ agendaId, imageBase64 }),
  });
}

export function authenticatedFileUrl(path: string) {
  return `${appConfig.apiUrl}${path}`;
}
