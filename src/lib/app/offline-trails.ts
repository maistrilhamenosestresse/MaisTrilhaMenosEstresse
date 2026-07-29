"use client";

const DATABASE_NAME = "mais-trilha-offline";
const STORE_NAME = "trail-routes";
const MAP_PACK_STORE_NAME = "trail-map-packs";
const DATABASE_VERSION = 2;

type OfflineTrail = {
  agendaId: string;
  geojson: unknown;
  savedAt: string;
};

export type OfflineMapPack = {
  agendaId: string;
  title?: string;
  version?: number;
  geojson: unknown;
  bounds: { south: number; west: number; north: number; east: number };
  attribution: string;
  featureCount: number;
  byteSize: number;
  savedAt: string;
  sourceGeneratedAt: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Armazenamento offline indisponível"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "agendaId" });
      }
      if (!database.objectStoreNames.contains(MAP_PACK_STORE_NAME)) {
        database.createObjectStore(MAP_PACK_STORE_NAME, { keyPath: "agendaId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento offline"));
  });
}

export async function saveOfflineTrail(agendaId: string, geojson: unknown) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        agendaId,
        geojson,
        savedAt: new Date().toISOString(),
      } satisfies OfflineTrail);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar rota"));
    });
  } finally {
    database.close();
  }
}

export async function getOfflineTrail(agendaId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<OfflineTrail | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(agendaId);
      request.onsuccess = () => resolve((request.result as OfflineTrail | undefined) || null);
      request.onerror = () => reject(request.error || new Error("Falha ao ler rota offline"));
    });
  } finally {
    database.close();
  }
}

export async function saveOfflineMapPack(pack: Omit<OfflineMapPack, "savedAt" | "byteSize">) {
  const database = await openDatabase();
  try {
    const serialized = JSON.stringify(pack.geojson);
    const stored: OfflineMapPack = {
      ...pack,
      savedAt: new Date().toISOString(),
      byteSize: new Blob([serialized]).size,
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MAP_PACK_STORE_NAME, "readwrite");
      transaction.objectStore(MAP_PACK_STORE_NAME).put(stored);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar mapa offline"));
    });
    return stored;
  } finally {
    database.close();
  }
}

export async function getOfflineMapPack(agendaId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<OfflineMapPack | null>((resolve, reject) => {
      const transaction = database.transaction(MAP_PACK_STORE_NAME, "readonly");
      const request = transaction.objectStore(MAP_PACK_STORE_NAME).get(agendaId);
      request.onsuccess = () => resolve((request.result as OfflineMapPack | undefined) || null);
      request.onerror = () => reject(request.error || new Error("Falha ao ler mapa offline"));
    });
  } finally {
    database.close();
  }
}

export async function listOfflineMapPacks() {
  const database = await openDatabase();
  try {
    return await new Promise<OfflineMapPack[]>((resolve, reject) => {
      const transaction = database.transaction(MAP_PACK_STORE_NAME, "readonly");
      const request = transaction.objectStore(MAP_PACK_STORE_NAME).getAll();
      request.onsuccess = () => {
        const packs = (request.result as OfflineMapPack[] | undefined) || [];
        resolve(packs.sort((first, second) => second.savedAt.localeCompare(first.savedAt)));
      };
      request.onerror = () => reject(request.error || new Error("Falha ao listar mapas offline"));
    });
  } finally {
    database.close();
  }
}

export async function deleteOfflineMapPack(agendaId: string) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MAP_PACK_STORE_NAME, "readwrite");
      transaction.objectStore(MAP_PACK_STORE_NAME).delete(agendaId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao excluir mapa offline"));
    });
  } finally {
    database.close();
  }
}

export async function clearAllOfflineTrailData() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Falha ao limpar mapas offline"));
    request.onblocked = () => resolve();
  });
}
