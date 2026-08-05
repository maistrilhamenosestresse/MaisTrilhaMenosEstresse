"use client";

import { useEffect } from "react";
import { clearLegacyOfflineData } from "@/lib/app/offline-data";

const VERSION_STORAGE_KEY = "mt-pwa-version";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type VersionResponse = {
  version?: string;
};

export default function PwaRuntime() {
  useEffect(() => {
    clearLegacyOfflineData();
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Service Workers não devem controlar o Turbopack em desenvolvimento.
    // Os nomes dos módulos locais podem ser reutilizados entre compilações e
    // um cache antigo quebra a árvore React mesmo quando o código está correto.
    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.allSettled(
            cacheNames
              .filter((name) => name.startsWith("mt-pwa-"))
              .map((name) => caches.delete(name)),
          );
        }
        localStorage.removeItem(VERSION_STORAGE_KEY);
      })();
      return;
    }

    let disposed = false;
    let checking = false;
    let shouldReloadOnControllerChange = false;
    let latestVersion = "";
    let warmedRoutes = false;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const reloadOnce = () => {
      if (disposed || !shouldReloadOnControllerChange) return;
      shouldReloadOnControllerChange = false;
      if (reloadTimer) clearTimeout(reloadTimer);
      if (latestVersion) localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
      window.location.reload();
    };

    const controllerChanged = () => reloadOnce();

    const syncVersion = async () => {
      if (checking || disposed || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(`/api/pwa/version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;

        const payload = await response.json() as VersionResponse;
        const version = payload.version?.trim();
        if (!version) return;

        latestVersion = version;
        const previousVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        const versionChanged = Boolean(previousVersion && previousVersion !== version);
        shouldReloadOnControllerChange = versionChanged;

        const registration = await navigator.serviceWorker.register(
          `/sw.js?v=${encodeURIComponent(version)}`,
          { scope: "/", updateViaCache: "none" },
        );
        await registration.update();
        if (!warmedRoutes || !previousVersion || versionChanged) {
          const readyRegistration = await navigator.serviceWorker.ready;
          (readyRegistration.active || registration.active)?.postMessage({ type: "WARM_APP_ROUTES" });
          warmedRoutes = true;
        }

        if (!previousVersion) {
          localStorage.setItem(VERSION_STORAGE_KEY, version);
        }

        if (versionChanged) {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          reloadTimer = setTimeout(reloadOnce, 1800);
        }
      } catch (error) {
        console.warn("Não foi possível verificar a atualização do aplicativo.", error);
      } finally {
        checking = false;
      }
    };

    const becameVisible = () => {
      if (document.visibilityState === "visible") void syncVersion();
    };

    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    document.addEventListener("visibilitychange", becameVisible);
    window.addEventListener("focus", syncVersion);
    window.addEventListener("online", syncVersion);
    void syncVersion();
    const interval = window.setInterval(syncVersion, CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      document.removeEventListener("visibilitychange", becameVisible);
      window.removeEventListener("focus", syncVersion);
      window.removeEventListener("online", syncVersion);
    };
  }, []);

  return null;
}
