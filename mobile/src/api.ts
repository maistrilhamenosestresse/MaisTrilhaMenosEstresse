import type { Session } from "@supabase/supabase-js";
import type { TrailMeshMessage } from "@trail-core";
import { appConfig } from "./config";

async function apiRequest<T>(
  session: Session,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
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
