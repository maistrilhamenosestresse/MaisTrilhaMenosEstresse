import * as SQLite from "expo-sqlite";
import type { ActiveOperation } from "./types";
import type { TrailMeshMessage } from "@trail-core";

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("mais-trilha-operations.db");
    const db = await databasePromise;
    await db.execAsync(`
      pragma journal_mode = WAL;
      pragma foreign_keys = ON;
      create table if not exists app_state (
        state_key text primary key,
        state_value text not null,
        updated_at text not null
      );
      create table if not exists mesh_messages (
        message_id text primary key,
        operation_id text not null,
        message_json text not null,
        direction text not null check (direction in ('local','received')),
        synced_at text,
        created_at text not null
      );
      create index if not exists mesh_messages_operation_sync_idx
        on mesh_messages(operation_id, synced_at, created_at);
      create table if not exists mesh_seen (
        message_id text primary key,
        seen_at text not null
      );
    `);
  }
  return databasePromise;
}

export async function setState<T>(key: string, value: T) {
  const db = await database();
  await db.runAsync(
    `insert into app_state (state_key, state_value, updated_at) values (?, ?, ?)
     on conflict(state_key) do update set state_value = excluded.state_value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function getState<T>(key: string): Promise<T | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ state_value: string }>(
    "select state_value from app_state where state_key = ?",
    key,
  );
  return row ? JSON.parse(row.state_value) as T : null;
}

export async function setActiveOperation(operation: ActiveOperation | null) {
  if (operation) return setState("active_operation", operation);
  const db = await database();
  await db.runAsync("delete from app_state where state_key = ?", "active_operation");
}

export function getActiveOperation() {
  return getState<ActiveOperation>("active_operation");
}

export async function saveMeshMessage(message: TrailMeshMessage, direction: "local" | "received") {
  const db = await database();
  await db.runAsync(
    `insert or ignore into mesh_messages
      (message_id, operation_id, message_json, direction, created_at)
     values (?, ?, ?, ?, ?)`,
    message.messageId,
    message.operationId,
    JSON.stringify(message),
    direction,
    message.clientCreatedAt,
  );
  await db.runAsync(
    "insert or replace into mesh_seen (message_id, seen_at) values (?, ?)",
    message.messageId,
    new Date().toISOString(),
  );
}

export async function hasSeenMessage(messageId: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ message_id: string }>(
    "select message_id from mesh_seen where message_id = ?",
    messageId,
  );
  return Boolean(row);
}

export async function unsyncedMessages(operationId: string, limit = 250) {
  const db = await database();
  const rows = await db.getAllAsync<{ message_json: string }>(
    `select message_json from mesh_messages
     where operation_id = ? and synced_at is null
     order by case json_extract(message_json, '$.eventType')
       when 'sos' then 1 when 'help' then 2 when 'rest' then 3 else 4 end,
       created_at asc limit ?`,
    operationId,
    limit,
  );
  return rows.map((row) => JSON.parse(row.message_json) as TrailMeshMessage);
}

export async function markMessagesSynced(messageIds: string[]) {
  if (!messageIds.length) return;
  const db = await database();
  const placeholders = messageIds.map(() => "?").join(",");
  await db.runAsync(
    `update mesh_messages set synced_at = ? where message_id in (${placeholders})`,
    new Date().toISOString(),
    ...messageIds,
  );
}

export async function recentMessages(operationId: string, limit = 500) {
  const db = await database();
  const rows = await db.getAllAsync<{ message_json: string }>(
    "select message_json from mesh_messages where operation_id = ? order by created_at desc limit ?",
    operationId,
    limit,
  );
  return rows.map((row) => JSON.parse(row.message_json) as TrailMeshMessage);
}

export async function pruneStorage() {
  const db = await database();
  await db.runAsync("delete from mesh_seen where seen_at < datetime('now', '-2 days')");
  await db.runAsync("delete from mesh_messages where synced_at is not null and created_at < datetime('now', '-30 days')");
}
