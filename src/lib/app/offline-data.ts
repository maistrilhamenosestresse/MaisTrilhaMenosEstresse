"use client";

const STORAGE_PREFIX = "mt-offline:v3";
export const LEGACY_OFFLINE_PREFIXES = ["mt-offline:v2:", "mt-offline:v1:"];

const OFFLINE_CLIENT_FIELDS = [
  "id",
  "full_name",
  "email",
  "photo_url",
  "pontos",
  "cashback_saldo",
  "experiencia",
  "membro_vip",
] as const;

export type OfflineEnvelope<T> = {
  savedAt: string;
  data: T;
};

function storageKey(userId: string, resource: string) {
  return `${STORAGE_PREFIX}:${userId}:${resource}`;
}

function minimalOfflineClient(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    OFFLINE_CLIENT_FIELDS
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  );
}

function sanitizeOfflineData(resource: string, data: unknown) {
  if (resource === "profile") return minimalOfflineClient(data);

  if (resource === "dashboard" && data && typeof data === "object" && !Array.isArray(data)) {
    const dashboard = data as Record<string, unknown>;
    return {
      ...dashboard,
      client: minimalOfflineClient(dashboard.client),
    };
  }

  return data;
}

export function saveOfflineData<T>(userId: string, resource: string, data: T) {
  if (typeof window === "undefined" || !userId) return;

  try {
    const payload: OfflineEnvelope<T> = {
      savedAt: new Date().toISOString(),
      data: sanitizeOfflineData(resource, data) as T,
    };
    window.localStorage.setItem(storageKey(userId, resource), JSON.stringify(payload));
  } catch (error) {
    console.warn("Não foi possível salvar os dados para uso offline.", error);
  }
}

export function getOfflineData<T>(userId: string, resource: string): OfflineEnvelope<T> | null {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const value = window.localStorage.getItem(storageKey(userId, resource));
    if (!value) return null;
    const parsed = JSON.parse(value) as OfflineEnvelope<T>;
    if (!parsed?.savedAt || parsed.data === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineUserData(userId?: string) {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(`${STORAGE_PREFIX}:`)) continue;
    if (!userId || key.startsWith(`${STORAGE_PREFIX}:${userId}:`)) {
      window.localStorage.removeItem(key);
    }
  }

  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
}

export function clearLegacyOfflineData() {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (
      key && (
        key === "carrinho-storage"
        || LEGACY_OFFLINE_PREFIXES.some((prefix) => key.startsWith(prefix))
      )
    ) {
      window.localStorage.removeItem(key);
    }
  }
}

export async function cacheAppRouteForOffline(path = window.location.pathname) {
  if (typeof window === "undefined" || !navigator.onLine || !("serviceWorker" in navigator)) return;
  if (!path.startsWith("/app")) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    (registration.active || navigator.serviceWorker.controller)?.postMessage({
      type: "CACHE_APP_ROUTE",
      path,
    });
  } catch (error) {
    console.warn("Não foi possível preparar esta tela para uso offline.", error);
  }
}

export function navigateAppOfflineFirst(
  router: { push: (href: string) => void; replace: (href: string) => void },
  href: string,
  mode: "push" | "replace" = "push",
) {
  if (typeof window !== "undefined" && !navigator.onLine && href.startsWith("/app")) {
    if (mode === "replace") window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  router[mode](href);
}

export function formatOfflineUpdate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
