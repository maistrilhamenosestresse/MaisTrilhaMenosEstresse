import type { TrailJoinPackage } from "@trail-core";

function encodeBase64Url(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(padded)));
}

export function createInviteCode(input: Omit<TrailJoinPackage, "version">) {
  return `MT1.${encodeBase64Url(JSON.stringify({ version: 1, ...input }))}`;
}

export function parseInviteCode(raw: string): TrailJoinPackage {
  const normalized = raw.trim().replace(/^maistrilha:\/\/join\//i, "");
  const encoded = normalized.startsWith("MT1.") ? normalized.slice(4) : normalized;
  const parsed = JSON.parse(decodeBase64Url(encoded)) as TrailJoinPackage;
  if (parsed.version !== 1 || !parsed.operationId || !parsed.joinToken || !parsed.groupKey) {
    throw new Error("Convite inválido.");
  }
  return parsed;
}
