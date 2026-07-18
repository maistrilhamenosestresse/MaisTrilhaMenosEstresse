import type { MemberStatus, TrailMeshMessage } from "@trail-core";

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
};

export type OperationMember = {
  id: string;
  operation_id: string;
  display_name: string;
  role: "guide" | "assistant_guide" | "sweeper" | "participant";
  device_id: string;
  signing_public_key?: string;
  last_status: MemberStatus;
  battery_percent: number | null;
  last_seen_at: string | null;
};

export type LatestLocation = {
  member_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  battery_percent: number | null;
  status: MemberStatus;
  client_created_at: string;
  updated_at: string;
};

export type ActiveOperation = {
  operation: Record<string, any>;
  member: OperationMember;
  joinToken?: string;
  groupKey: string;
  signingPrivateKey: string;
  signingPublicKey: string;
  memberDirectory?: Record<string, string>;
  deviceId: string;
  cursor?: string;
  mapPack?: Record<string, any> | null;
  pois?: Record<string, any>[];
  trailRoute?: Record<string, any> | null;
};

export type MeshState = {
  peers: number;
  relayed: number;
  lastContactAt?: string;
  events: TrailMeshMessage[];
};
