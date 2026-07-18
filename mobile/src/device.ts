import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import { getState, setState } from "./storage";

export async function getDeviceId() {
  const existing = await getState<string>("device_id");
  if (existing) return existing;
  const installation = Application.getAndroidId() || Crypto.randomUUID();
  const deviceId = `mt-${installation.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 90)}`;
  await setState("device_id", deviceId);
  return deviceId;
}
