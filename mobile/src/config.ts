import Constants from "expo-constants";

type AppExtra = {
  appVariant?: "participant" | "guide";
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  nearbyServiceId?: string;
};

const extra = (Constants.expoConfig?.extra || {}) as AppExtra;

export const appConfig = {
  variant: extra.appVariant === "guide" ? "guide" as const : "participant" as const,
  apiUrl: String(extra.apiUrl || "").replace(/\/+$/, ""),
  supabaseUrl: String(extra.supabaseUrl || ""),
  supabaseAnonKey: String(extra.supabaseAnonKey || ""),
  nearbyServiceId: String(extra.nearbyServiceId || "com.maistrilhasmenosestresse.mesh.v1"),
};

export function assertMobileConfig() {
  if (!appConfig.apiUrl || !appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error("Configure API e Supabase no ambiente do aplicativo.");
  }
}
