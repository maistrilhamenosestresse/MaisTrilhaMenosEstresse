import { requireOptionalNativeModule } from "expo-modules-core";

export type NearbyStatusEvent = {
  state: "starting" | "running" | "stopped" | "error";
  peers: number;
  detail?: string;
};

export type NearbyMessageEvent = {
  endpointId: string;
  data: string;
};

type StartOptions = {
  serviceId: string;
  operationId: string;
  endpointName: string;
};

type NearbyNativeModule = {
  start(options: StartOptions): Promise<void>;
  stop(): Promise<void>;
  broadcast(data: string): Promise<number>;
  addListener(eventName: "onStatus", listener: (event: NearbyStatusEvent) => void): { remove(): void };
  addListener(eventName: "onMessage", listener: (event: NearbyMessageEvent) => void): { remove(): void };
};

const nativeModule = requireOptionalNativeModule<NearbyNativeModule>("NearbyMesh");
const simulatedStatusListeners = new Set<(event: NearbyStatusEvent) => void>();

function simulatedSubscription(remove: () => void) {
  return { remove };
}

export const NearbyMesh = {
  async start(options: StartOptions): Promise<void> {
    if (nativeModule) return nativeModule.start(options);
    setTimeout(() => {
      for (const listener of simulatedStatusListeners) {
        listener({
          state: "running",
          peers: 0,
          detail: "Demonstração no iPhone — rede Bluetooth simulada",
        });
      }
    }, 0);
  },
  async stop(): Promise<void> {
    if (nativeModule) return nativeModule.stop();
  },
  async broadcast(data: string): Promise<number> {
    if (nativeModule) return nativeModule.broadcast(data);
    return 0;
  },
  onStatus(listener: (event: NearbyStatusEvent) => void) {
    if (nativeModule) return nativeModule.addListener("onStatus", listener);
    simulatedStatusListeners.add(listener);
    return simulatedSubscription(() => simulatedStatusListeners.delete(listener));
  },
  onMessage(listener: (event: NearbyMessageEvent) => void) {
    if (nativeModule) return nativeModule.addListener("onMessage", listener);
    return simulatedSubscription(() => undefined);
  },
};
