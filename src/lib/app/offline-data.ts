"use client";

const STORAGE_PREFIX = "mt-offline:v2";

export type OfflineEnvelope<T> = {
  savedAt: string;
  data: T;
};

function storageKey(userId: string, resource: string) {
  return `${STORAGE_PREFIX}:${userId}:${resource}`;
}

export function saveOfflineData<T>(userId: string, resource: string, data: T) {
  if (typeof window === "undefined" || !userId) return;

  try {
    const payload: OfflineEnvelope<T> = {
      savedAt: new Date().toISOString(),
      data,
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

export function formatOfflineUpdate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
