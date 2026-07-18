import { assertTrailMessage, messagePriority, prepareMessageForRelay, shouldReplaceQueuedLocation } from "./protocol";
import type { TrailMeshMessage } from "./types";

export class TrailMeshQueue {
  private readonly seen = new Map<string, number>();
  private queue: TrailMeshMessage[] = [];

  constructor(
    private readonly maxQueueSize = 2000,
    private readonly seenRetentionMs = 24 * 60 * 60 * 1000,
  ) {}

  receive(message: TrailMeshMessage, now = new Date()) {
    assertTrailMessage(message);
    this.prune(now);
    if (this.seen.has(message.messageId)) return { accepted: false, relay: null };
    this.seen.set(message.messageId, now.getTime());

    const relay = prepareMessageForRelay(message, new Set(), now);
    if (relay) this.enqueue(relay);
    return { accepted: true, relay };
  }

  enqueue(message: TrailMeshMessage) {
    assertTrailMessage(message);
    const replaceIndex = this.queue.findIndex((queued) => shouldReplaceQueuedLocation(queued, message));
    if (replaceIndex >= 0) this.queue.splice(replaceIndex, 1);
    if (this.queue.some((queued) => queued.messageId === message.messageId)) return;
    this.queue.push(message);
    this.queue.sort((a, b) => {
      const priority = messagePriority(b.eventType) - messagePriority(a.eventType);
      return priority || Date.parse(a.clientCreatedAt) - Date.parse(b.clientCreatedAt);
    });
    if (this.queue.length > this.maxQueueSize) this.queue.length = this.maxQueueSize;
  }

  nextBatch(limit = 50, now = new Date()) {
    this.prune(now);
    return this.queue.slice(0, Math.min(100, Math.max(1, limit)));
  }

  acknowledge(messageIds: readonly string[]) {
    const acknowledged = new Set(messageIds);
    this.queue = this.queue.filter((message) => !acknowledged.has(message.messageId));
  }

  markSeen(messageId: string, now = new Date()) {
    this.seen.set(messageId, now.getTime());
  }

  hasSeen(messageId: string) {
    return this.seen.has(messageId);
  }

  size() {
    return this.queue.length;
  }

  snapshot() {
    return {
      queued: [...this.queue],
      seen: [...this.seen.entries()],
    };
  }

  restore(snapshot: { queued?: TrailMeshMessage[]; seen?: [string, number][] }) {
    this.queue = [];
    this.seen.clear();
    for (const [messageId, timestamp] of snapshot.seen || []) this.seen.set(messageId, timestamp);
    for (const message of snapshot.queued || []) this.enqueue(message);
  }

  private prune(now: Date) {
    const nowMs = now.getTime();
    this.queue = this.queue.filter((message) => Date.parse(message.expiresAt) > nowMs);
    for (const [messageId, timestamp] of this.seen) {
      if (timestamp + this.seenRetentionMs < nowMs) this.seen.delete(messageId);
    }
  }
}
