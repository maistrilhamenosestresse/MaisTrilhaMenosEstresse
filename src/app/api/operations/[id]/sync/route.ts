import { NextResponse } from "next/server";
import { assertTrailMessage, type TrailMeshMessage } from "@trail-core";
import { requireAuthenticatedRequest } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  cleanDeviceId,
  isUuid,
  OPERATION_MEMBER_STATUSES,
  resolveOperationMember,
  verifyTrailMessageSignature,
} from "@/lib/server/trail-operations";

type SyncBody = {
  deviceId?: string;
  cursor?: string | null;
  events?: unknown[];
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const rateError = await enforceRateLimit(request, "trail-operation-sync", 600, 60);
  if (rateError) return rateError;
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  const parsed = await readJsonBody<SyncBody>(request, 900_000);
  if (parsed.response) return parsed.response;
  const deviceId = cleanDeviceId(parsed.data.deviceId);
  const incoming = Array.isArray(parsed.data.events) ? parsed.data.events : [];
  if (!deviceId || incoming.length > 250) {
    return NextResponse.json({ error: "Lote ou dispositivo inválido" }, { status: 400 });
  }

  const callerMember = await resolveOperationMember(auth.user, id, deviceId);
  if (!callerMember || callerMember.left_at) {
    return NextResponse.json({ error: "Dispositivo não participa desta operação" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const { data: operation } = await supabase
    .from("trail_operations")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!operation || operation.status === "cancelled") {
    return NextResponse.json({ error: "Operação indisponível" }, { status: 409 });
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("trail_operation_members")
    .select("id, device_id, signing_public_key")
    .eq("operation_id", id);
  if (membersError) return NextResponse.json({ error: "Falha ao validar integrantes" }, { status: 500 });
  const members = new Map((memberRows || []).map((member) => [member.id, member]));
  const valid: TrailMeshMessage[] = [];
  const rejected: Array<{ messageId?: string; reason: string }> = [];
  const now = Date.now();

  for (const candidate of incoming) {
    try {
      assertTrailMessage(candidate);
      const message = candidate as TrailMeshMessage;
      const origin = members.get(message.senderMemberId);
      const payloadBytes = Buffer.byteLength(JSON.stringify(message.payload), "utf8");
      if (message.operationId !== id) throw new Error("Operação divergente");
      if (message.originDeviceId.length > 120) throw new Error("Dispositivo de origem inválido");
      if (!origin || origin.device_id !== message.originDeviceId) throw new Error("Origem não reconhecida");
      if (!message.signature || message.signature.length > 180 ||
          !verifyTrailMessageSignature(message, origin.signing_public_key)) {
        throw new Error("Assinatura inválida");
      }
      const createdAt = Date.parse(message.clientCreatedAt);
      const expiresAt = Date.parse(message.expiresAt);
      if (createdAt > now + 10 * 60_000 || createdAt < now - 30 * 24 * 60 * 60_000) {
        throw new Error("Data fora da janela permitida");
      }
      if (expiresAt <= now || expiresAt > createdAt + 24 * 60 * 60_000) {
        throw new Error("Validade da mensagem inválida");
      }
      if (payloadBytes > 16_000) throw new Error("Conteúdo excede o limite");
      valid.push(message);
    } catch (error) {
      const messageId = candidate && typeof candidate === "object"
        ? String((candidate as Record<string, unknown>).messageId || "") || undefined
        : undefined;
      rejected.push({ messageId, reason: error instanceof Error ? error.message : "Evento inválido" });
    }
  }

  if (valid.length) {
    const rows = valid.map((event) => ({
      message_id: event.messageId,
      operation_id: id,
      sender_member_id: event.senderMemberId,
      origin_device_id: event.originDeviceId,
      event_type: event.eventType,
      client_created_at: event.clientCreatedAt,
      expires_at: event.expiresAt,
      latitude: event.position?.latitude ?? null,
      longitude: event.position?.longitude ?? null,
      accuracy_meters: event.position?.accuracyMeters ?? null,
      battery_percent: event.batteryPercent ?? null,
      status: event.status ?? null,
      hop_count: event.hopCount,
      max_hops: event.maxHops,
      signature: event.signature,
      payload: event.payload,
    }));
    const { error: insertError } = await supabase
      .from("trail_operation_events")
      .upsert(rows, { onConflict: "message_id", ignoreDuplicates: true });
    if (insertError) return NextResponse.json({ error: "Falha ao salvar eventos" }, { status: 500 });

    for (const event of valid) {
      if (event.position) {
        await supabase.rpc("upsert_trail_latest_location", {
          p_member_id: event.senderMemberId,
          p_operation_id: id,
          p_source_message_id: event.messageId,
          p_latitude: event.position.latitude,
          p_longitude: event.position.longitude,
          p_accuracy_meters: event.position.accuracyMeters ?? null,
          p_battery_percent: event.batteryPercent ?? null,
          p_status: event.status || "ok",
          p_client_created_at: event.clientCreatedAt,
        });
      }
      const memberUpdate: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
      if (event.batteryPercent !== undefined) memberUpdate.battery_percent = Math.round(event.batteryPercent);
      if (event.status && OPERATION_MEMBER_STATUSES.has(event.status)) memberUpdate.last_status = event.status;
      await supabase.from("trail_operation_members").update(memberUpdate).eq("id", event.senderMemberId);
    }
  }

  await supabase.from("trail_operation_members").update({
    last_seen_at: new Date().toISOString(),
  }).eq("id", callerMember.id);

  const cursor = parsed.data.cursor && Number.isFinite(Date.parse(parsed.data.cursor))
    ? new Date(parsed.data.cursor).toISOString()
    : new Date(Date.now() - 6 * 60 * 60_000).toISOString();
  const { data: outgoing, error: outgoingError } = await supabase
    .from("trail_operation_events")
    .select("*")
    .eq("operation_id", id)
    .gt("received_at", cursor)
    .order("received_at", { ascending: true })
    .limit(500);
  if (outgoingError) return NextResponse.json({ error: "Falha ao receber eventos" }, { status: 500 });
  const nextCursor = outgoing?.at(-1)?.received_at || new Date().toISOString();

  return NextResponse.json({
    acceptedMessageIds: valid.map((event) => event.messageId),
    rejected,
    events: outgoing || [],
    memberDirectory: Object.fromEntries(
      (memberRows || []).map((member) => [member.id, member.signing_public_key]),
    ),
    nextCursor,
    serverTime: new Date().toISOString(),
  });
}
