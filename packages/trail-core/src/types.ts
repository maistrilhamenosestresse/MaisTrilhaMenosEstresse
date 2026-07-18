export const TRAIL_PROTOCOL_VERSION = 1 as const;

export const TRAIL_EVENT_TYPES = [
  "location",
  "status",
  "rest",
  "help",
  "sos",
  "incident",
  "checkpoint",
  "battery",
  "mesh_ack",
  "member_joined",
  "member_left",
  "system",
] as const;

export type TrailEventType = (typeof TRAIL_EVENT_TYPES)[number];

export const MEMBER_STATUSES = [
  "ok",
  "rest_requested",
  "help_requested",
  "sos",
  "off_route",
  "disconnected",
  "finished",
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitudeMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
};

export type TrailMeshMessage = {
  protocolVersion: typeof TRAIL_PROTOCOL_VERSION;
  messageId: string;
  operationId: string;
  senderMemberId: string;
  originDeviceId: string;
  eventType: TrailEventType;
  clientCreatedAt: string;
  expiresAt: string;
  hopCount: number;
  maxHops: number;
  position?: GeoPosition;
  batteryPercent?: number;
  status?: MemberStatus;
  payload: Record<string, unknown>;
  signature?: string;
};

export type EncryptedTrailEnvelope = {
  protocolVersion: typeof TRAIL_PROTOCOL_VERSION;
  operationId: string;
  messageId: string;
  nonce: string;
  ciphertext: string;
  senderHint: string;
};

export type TrailOperationMember = {
  id: string;
  operationId: string;
  displayName: string;
  role: "guide" | "assistant_guide" | "sweeper" | "participant";
  deviceId: string;
  status: MemberStatus;
  batteryPercent?: number;
  lastSeenAt?: string;
};

export type TrailSyncCursor = {
  receivedAt: string;
  messageId: string;
};

export type TrailJoinPackage = {
  version: 1;
  operationId: string;
  joinToken: string;
  groupKey: string;
  expiresAt?: string;
};
