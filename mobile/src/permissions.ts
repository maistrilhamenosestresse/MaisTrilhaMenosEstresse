import { PermissionsAndroid, Platform } from "react-native";
import * as Location from "expo-location";
import { runtimeCapabilities } from "./runtimeCapabilities";

export async function requestTrailPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) throw new Error("A localização precisa ser permitida para a segurança da trilha.");

  if (!runtimeCapabilities.backgroundLocation) return;

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    throw new Error("Ative “Permitir o tempo todo” para funcionar com a tela bloqueada.");
  }

  if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ]);
    const denied = Object.values(result).some((value) => value !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied) throw new Error("Permita os aparelhos próximos para conectar o grupo sem internet.");
  }
}
