"use client";

export async function fetchCurrentClient<T = Record<string, unknown>>(): Promise<T | null> {
  const response = await fetch("/api/clients/me", { cache: "no-store" });
  if (!response.ok) return null;
  const result = await response.json().catch(() => ({}));
  return (result.client as T | undefined) || null;
}
