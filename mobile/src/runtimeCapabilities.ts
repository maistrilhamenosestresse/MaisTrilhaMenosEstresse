import Constants, { ExecutionEnvironment } from "expo-constants";

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const runtimeCapabilities = {
  nativeMesh: !isExpoGo,
  nativeOfflineMaps: !isExpoGo,
  backgroundLocation: !isExpoGo,
} as const;

export const demoModeMessage =
  "Modo de teste no iPhone: Bluetooth em malha, mapa offline e localização em segundo plano estão simulados.";
