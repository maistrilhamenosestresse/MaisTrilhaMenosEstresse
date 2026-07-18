import type { Session } from "@supabase/supabase-js";
import type { EncryptedTrailEnvelope, TrailMeshMessage } from "@trail-core";
import { assertTrailMessage, prepareMessageForRelay } from "@trail-core";
import { appConfig } from "./config";
import { decryptMeshMessage, encryptMeshMessage, verifyTrailMessage } from "./crypto";
import {
  hasSeenMessage,
  markMessagesSynced,
  saveMeshMessage,
  setActiveOperation,
  unsyncedMessages,
} from "./storage";
import { NearbyMesh, type NearbyStatusEvent } from "../modules/nearby-mesh";
import { syncOperation } from "./api";
import type { ActiveOperation } from "./types";

type MeshListener = (state: { peers: number; relayed: number; status: string; lastContactAt?: string }) => void;

export class TrailMeshRuntime {
  private subscriptions: Array<{ remove(): void }> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private peers = 0;
  private relayed = 0;
  private listeners = new Set<MeshListener>();
  private broadcasting = false;
  private syncing = false;

  constructor(
    private active: ActiveOperation,
    private session: Session,
  ) {}

  subscribe(listener: MeshListener) {
    this.listeners.add(listener);
    this.emit("running");
    return () => this.listeners.delete(listener);
  }

  updateActive(active: ActiveOperation) {
    this.active = active;
  }

  async start() {
    this.subscriptions.push(
      NearbyMesh.onStatus((event) => {
        this.peers = event.peers;
        this.emit(event.state, event.detail);
      }),
      NearbyMesh.onMessage((event) => {
        void this.receive(event.data);
      }),
    );
    await NearbyMesh.start({
      serviceId: appConfig.nearbyServiceId,
      operationId: String(this.active.operation.id),
      endpointName: `${this.active.member.display_name}|${this.active.deviceId.slice(-6)}`,
    });
    this.timer = setInterval(() => {
      void this.pump();
    }, 4_000);
    await this.pump();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    await NearbyMesh.stop();
  }

  async pump() {
    await Promise.allSettled([this.broadcastPending(), this.syncServer()]);
  }

  private async receive(raw: string) {
    try {
      const envelope = JSON.parse(raw) as EncryptedTrailEnvelope;
      if (envelope.operationId !== String(this.active.operation.id)) return;
      const message = await decryptMeshMessage(envelope, this.active.groupKey);
      assertTrailMessage(message);
      if (await hasSeenMessage(message.messageId)) return;
      const publicKey = this.active.memberDirectory?.[message.senderMemberId];
      if (!publicKey || !(await verifyTrailMessage(message, publicKey))) return;
      await saveMeshMessage(message, "received");
      const relay = prepareMessageForRelay(message, new Set(), new Date());
      if (relay) {
        await this.broadcast(relay);
        this.relayed += 1;
      }
      this.emit("running", undefined, new Date().toISOString());
    } catch {
      // Pacotes de outras operações ou inválidos são descartados sem revelar detalhes.
    }
  }

  private async broadcastPending() {
    if (this.broadcasting || this.peers === 0) return;
    this.broadcasting = true;
    try {
      const pending = await unsyncedMessages(String(this.active.operation.id), 40);
      for (const message of pending) await this.broadcast(message);
    } finally {
      this.broadcasting = false;
    }
  }

  private async broadcast(message: TrailMeshMessage) {
    const envelope = await encryptMeshMessage(message, this.active.groupKey);
    await NearbyMesh.broadcast(JSON.stringify(envelope));
  }

  private async syncServer() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const events = await unsyncedMessages(String(this.active.operation.id), 250);
      const result = await syncOperation(this.session, String(this.active.operation.id), {
        deviceId: this.active.deviceId,
        cursor: this.active.cursor,
        events,
      });
      await markMessagesSynced(result.acceptedMessageIds);
      for (const row of result.events) {
        const message = serverEventToMessage(row);
        if (message && !(await hasSeenMessage(message.messageId))) {
          await saveMeshMessage(message, "received");
          await markMessagesSynced([message.messageId]);
        }
      }
      this.active = {
        ...this.active,
        cursor: result.nextCursor,
        memberDirectory: result.memberDirectory || this.active.memberDirectory,
      };
      await setActiveOperation(this.active);
      this.emit("running", undefined, new Date().toISOString());
    } catch {
      this.emit("offline");
    } finally {
      this.syncing = false;
    }
  }

  private emit(status: string, detail?: string, lastContactAt?: string) {
    for (const listener of this.listeners) {
      listener({ peers: this.peers, relayed: this.relayed, status: detail || status, lastContactAt });
    }
  }
}

function serverEventToMessage(row: Record<string, any>): TrailMeshMessage | null {
  try {
    const message: TrailMeshMessage = {
      protocolVersion: 1,
      messageId: row.message_id,
      operationId: row.operation_id,
      senderMemberId: row.sender_member_id,
      originDeviceId: row.origin_device_id,
      eventType: row.event_type,
      clientCreatedAt: row.client_created_at,
      expiresAt: row.expires_at,
      hopCount: row.hop_count || 0,
      maxHops: row.max_hops || 8,
      payload: row.payload || {},
      signature: row.signature,
    };
    if (row.latitude !== null && row.longitude !== null) {
      message.position = {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyMeters: row.accuracy_meters || undefined,
      };
    }
    if (row.battery_percent !== null) message.batteryPercent = row.battery_percent;
    if (row.status) message.status = row.status;
    assertTrailMessage(message);
    return message;
  } catch {
    return null;
  }
}
