import assert from "node:assert/strict";
import test from "node:test";
import {
  createTrailMessage,
  distanceToRouteMeters,
  prepareMessageForRelay,
  TrailMeshQueue,
} from "../../packages/trail-core/src/index";

const ids = {
  messageId: "11111111-1111-4111-8111-111111111111",
  operationId: "22222222-2222-4222-8222-222222222222",
  senderMemberId: "33333333-3333-4333-8333-333333333333",
};

test("repassa uma mensagem até o limite de saltos e bloqueia duplicata", () => {
  const message = createTrailMessage({
    ...ids,
    originDeviceId: "android-participante-123",
    eventType: "sos",
    maxHops: 3,
  });
  const first = prepareMessageForRelay(message, new Set());
  assert.equal(first?.hopCount, 1);
  assert.equal(prepareMessageForRelay(message, new Set([message.messageId])), null);
  assert.equal(prepareMessageForRelay({ ...message, hopCount: 3 }, new Set()), null);
});

test("fila prioriza SOS e compacta localizações antigas", () => {
  const queue = new TrailMeshQueue();
  const location = createTrailMessage({
    ...ids,
    originDeviceId: "android-participante-123",
    eventType: "location",
    position: { latitude: -15.79, longitude: -47.88 },
  });
  const newer = createTrailMessage({
    ...ids,
    messageId: "44444444-4444-4444-8444-444444444444",
    originDeviceId: "android-participante-123",
    eventType: "location",
    createdAt: new Date(Date.now() + 1000),
    position: { latitude: -15.791, longitude: -47.881 },
  });
  const sos = createTrailMessage({
    ...ids,
    messageId: "55555555-5555-4555-8555-555555555555",
    originDeviceId: "android-participante-123",
    eventType: "sos",
  });
  queue.enqueue(location);
  queue.enqueue(newer);
  queue.enqueue(sos);
  assert.equal(queue.size(), 2);
  assert.equal(queue.nextBatch()[0].eventType, "sos");
});

test("detecta afastamento da rota em metros", () => {
  const route = {
    type: "LineString",
    coordinates: [[-47.88, -15.79], [-47.879, -15.79]],
  };
  const near = distanceToRouteMeters({ latitude: -15.7901, longitude: -47.8795 }, route);
  const far = distanceToRouteMeters({ latitude: -15.80, longitude: -47.8795 }, route);
  assert.ok(near !== null && near < 20);
  assert.ok(far !== null && far > 1000);
});
