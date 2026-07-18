import { EventEmitter, requireNativeModule } from "expo-modules-core";

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

const module = requireNativeModule("NearbyMesh");
const emitter = new EventEmitter(module) as any;

export const NearbyMesh = {
  start(options: StartOptions): Promise<void> {
    return module.start(options);
  },
  stop(): Promise<void> {
    return module.stop();
  },
  broadcast(data: string): Promise<number> {
    return module.broadcast(data);
  },
  onStatus(listener: (event: NearbyStatusEvent) => void) {
    return emitter.addListener("onStatus", listener);
  },
  onMessage(listener: (event: NearbyMessageEvent) => void) {
    return emitter.addListener("onMessage", listener);
  },
};
