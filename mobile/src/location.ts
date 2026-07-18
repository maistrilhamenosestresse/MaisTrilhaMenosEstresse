import * as Battery from "expo-battery";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { createTrailMessage, distanceToRouteMeters } from "@trail-core";
import { signTrailMessage } from "./crypto";
import { getActiveOperation, getState, saveMeshMessage, setActiveOperation, setState } from "./storage";

export const LOCATION_TASK = "mais-trilha-background-location";

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const active = await getActiveOperation();
  if (!active) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
  const location = locations.at(-1);
  if (!location) return;
  const battery = Math.round((await Battery.getBatteryLevelAsync()) * 100);
  const distanceFromRoute = distanceToRouteMeters({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  }, active.trailRoute);
  const offRouteThreshold = Number(active.operation.settings?.off_route_meters || 50);
  const offRoute = distanceFromRoute !== null && distanceFromRoute > offRouteThreshold;
  const lastOffRouteAlert = await getState<string>("last_off_route_alert");
  const shouldAlertOffRoute = offRoute && (
    !lastOffRouteAlert || Date.now() - Date.parse(lastOffRouteAlert) > 5 * 60_000
  );
  const message = createTrailMessage({
    messageId: Crypto.randomUUID(),
    operationId: String(active.operation.id),
    senderMemberId: active.member.id,
    originDeviceId: active.deviceId,
    eventType: shouldAlertOffRoute ? "status" : "location",
    maxHops: Number(active.operation.settings?.max_hops || 8),
    position: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy || undefined,
      altitudeMeters: location.coords.altitude || undefined,
      headingDegrees: location.coords.heading || undefined,
      speedMetersPerSecond: location.coords.speed || undefined,
    },
    batteryPercent: battery >= 0 ? battery : undefined,
    status: shouldAlertOffRoute ? "off_route" : active.member.last_status,
    payload: shouldAlertOffRoute ? {
      distanceFromRouteMeters: Math.round(distanceFromRoute || 0),
      automatic: true,
    } : {},
  });
  const signed = await signTrailMessage(message, active.signingPrivateKey);
  await saveMeshMessage(signed, "local");
  if (shouldAlertOffRoute) {
    const now = new Date().toISOString();
    await setState("last_off_route_alert", now);
    await setActiveOperation({
      ...active,
      member: { ...active.member, last_status: "off_route" },
    });
  }
});

export async function startTrailLocation(intervalSeconds = 15) {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: Math.max(5, intervalSeconds) * 1000,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    deferredUpdatesDistance: 10,
    deferredUpdatesInterval: Math.max(10, intervalSeconds) * 1000,
    foregroundService: {
      notificationTitle: "Mais Trilha — segurança ativa",
      notificationBody: "Localização e conexão do grupo funcionando.",
      notificationColor: "#D96224",
      killServiceOnDestroy: false,
    },
  });
}

export async function stopTrailLocation() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function currentPosition() {
  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
    mayShowUserSettingsDialog: true,
  });
}
