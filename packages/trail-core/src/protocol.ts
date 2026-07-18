import {
  MEMBER_STATUSES,
  TRAIL_EVENT_TYPES,
  TRAIL_PROTOCOL_VERSION,
  type TrailEventType,
  type TrailMeshMessage,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTrailMessage(input: {
  messageId: string;
  operationId: string;
  senderMemberId: string;
  originDeviceId: string;
  eventType: TrailEventType;
  createdAt?: Date;
  ttlSeconds?: number;
  maxHops?: number;
  position?: TrailMeshMessage["position"];
  batteryPercent?: number;
  status?: TrailMeshMessage["status"];
  payload?: Record<string, unknown>;
}): TrailMeshMessage {
  const createdAt = input.createdAt || new Date();
  const ttlSeconds = Math.min(24 * 60 * 60, Math.max(60, input.ttlSeconds || 6 * 60 * 60));
  const message: TrailMeshMessage = {
    protocolVersion: TRAIL_PROTOCOL_VERSION,
    messageId: input.messageId,
    operationId: input.operationId,
    senderMemberId: input.senderMemberId,
    originDeviceId: input.originDeviceId.slice(0, 120),
    eventType: input.eventType,
    clientCreatedAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString(),
    hopCount: 0,
    maxHops: Math.min(16, Math.max(1, input.maxHops || 8)),
    payload: input.payload || {},
  };
  if (input.position) message.position = input.position;
  if (input.batteryPercent !== undefined) message.batteryPercent = input.batteryPercent;
  if (input.status) message.status = input.status;
  assertTrailMessage(message);
  return message;
}

export function assertTrailMessage(value: unknown): asserts value is TrailMeshMessage {
  if (!value || typeof value !== "object") throw new Error("Mensagem de trilha inválida");
  const message = value as Partial<TrailMeshMessage>;
  if (message.protocolVersion !== TRAIL_PROTOCOL_VERSION) throw new Error("Versão do protocolo incompatível");
  for (const id of [message.messageId, message.operationId, message.senderMemberId]) {
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new Error("Identificador de mensagem inválido");
  }
  if (typeof message.originDeviceId !== "string" || !message.originDeviceId.trim()) {
    throw new Error("Dispositivo de origem inválido");
  }
  if (!TRAIL_EVENT_TYPES.includes(message.eventType as TrailEventType)) throw new Error("Tipo de evento inválido");
  if (!isValidDate(message.clientCreatedAt) || !isValidDate(message.expiresAt)) throw new Error("Data de mensagem inválida");
  if (!Number.isInteger(message.hopCount) || Number(message.hopCount) < 0) throw new Error("Número de saltos inválido");
  if (!Number.isInteger(message.maxHops) || Number(message.maxHops) < 1 || Number(message.maxHops) > 16) {
    throw new Error("Limite de saltos inválido");
  }
  if (message.status && !MEMBER_STATUSES.includes(message.status)) throw new Error("Estado do participante inválido");
  if (message.batteryPercent !== undefined && (
    !Number.isFinite(message.batteryPercent) || message.batteryPercent < 0 || message.batteryPercent > 100
  )) throw new Error("Bateria inválida");
  if (message.position) {
    if (!Number.isFinite(message.position.latitude) || message.position.latitude < -90 || message.position.latitude > 90) {
      throw new Error("Latitude inválida");
    }
    if (!Number.isFinite(message.position.longitude) || message.position.longitude < -180 || message.position.longitude > 180) {
      throw new Error("Longitude inválida");
    }
  }
  if (!message.payload || typeof message.payload !== "object" || Array.isArray(message.payload)) {
    throw new Error("Conteúdo da mensagem inválido");
  }
}

export function prepareMessageForRelay(
  message: TrailMeshMessage,
  seenMessageIds: ReadonlySet<string>,
  now = new Date(),
) {
  assertTrailMessage(message);
  if (seenMessageIds.has(message.messageId)) return null;
  if (new Date(message.expiresAt).getTime() <= now.getTime()) return null;
  if (message.hopCount >= message.maxHops) return null;
  return { ...message, hopCount: message.hopCount + 1 };
}

export function trailMessageSigningPayload(message: TrailMeshMessage) {
  const signable = {
    protocolVersion: message.protocolVersion,
    messageId: message.messageId,
    operationId: message.operationId,
    senderMemberId: message.senderMemberId,
    originDeviceId: message.originDeviceId,
    eventType: message.eventType,
    clientCreatedAt: message.clientCreatedAt,
    expiresAt: message.expiresAt,
    maxHops: message.maxHops,
    position: message.position || null,
    batteryPercent: message.batteryPercent ?? null,
    status: message.status || null,
    payload: message.payload,
  };
  return stableStringify(signable);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(",")}}`;
}

export function messagePriority(eventType: TrailEventType) {
  if (eventType === "sos") return 100;
  if (eventType === "help") return 90;
  if (eventType === "rest" || eventType === "incident") return 70;
  if (eventType === "status" || eventType === "checkpoint") return 50;
  if (eventType === "location") return 20;
  return 10;
}

export function shouldReplaceQueuedLocation(
  queued: TrailMeshMessage,
  incoming: TrailMeshMessage,
) {
  return queued.eventType === "location" &&
    incoming.eventType === "location" &&
    queued.senderMemberId === incoming.senderMemberId &&
    new Date(incoming.clientCreatedAt).getTime() > new Date(queued.clientCreatedAt).getTime();
}

function isValidDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
