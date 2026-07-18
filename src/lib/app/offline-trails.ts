"use client";

const DATABASE_NAME = "mais-trilha-offline";
const STORE_NAME = "trail-routes";
const DATABASE_VERSION = 1;

type OfflineTrail = {
  agendaId: string;
  geojson: unknown;
  savedAt: string;
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
