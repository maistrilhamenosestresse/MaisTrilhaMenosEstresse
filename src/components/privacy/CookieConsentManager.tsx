"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const COOKIE_NAME = "mt_cookie_consent";
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const ANALYTICS_BLOCKED_ROUTES = [
  "/admin",
  "/app",
  "/checkout",
  "/cadastro",
  "/contratos",
  "/login",
  "/termo",
];

type ConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  decidedAt: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent(): ConsentPreferences | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as ConsentPreferences;
    if (
      parsed.version !== CONSENT_VERSION
      || parsed.necessary !== true
      || typeof parsed.analytics !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistConsent(analytics: boolean) {
  const value: ConsentPreferences = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  return value;
}

function removeAnalyticsCookies() {
  const hostname = window.location.hostname;
  const domainCandidates = ["", hostname, `.${hostname}`, ".maistrilhasmenosestresse.com"];
  const cookieNames = document.cookie
    .split(";")
    .map((item) => item.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  for (const name of cookieNames) {
    for (const domain of domainCandidates) {
      const domainAttribute = domain ? `; Domain=${domain}` : "";
      document.cookie = `${name}=; Max-Age=0; Path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

export default function CookieConsentManager({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const analyticsAllowedOnRoute = useMemo(
    () => !ANALYTICS_BLOCKED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname],
  );
  const analyticsEnabled = Boolean(
    gaId
    && consent?.analytics
    && analyticsAllowedOnRoute,
  );

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setDraftAnalytics(saved?.analytics ?? false);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (analyticsEnabled || !consent) return;
    window.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    removeAnalyticsCookies();
  }, [analyticsEnabled, consent]);

  useEffect(() => {
    if (!analyticsEnabled || !analyticsLoaded || !window.gtag) return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [analyticsEnabled, analyticsLoaded, pathname]);

  const applyChoice = (analytics: boolean) => {
    const saved = persistConsent(analytics);
    setConsent(saved);
    setDraftAnalytics(analytics);
    setSettingsOpen(false);
    if (!analytics) removeAnalyticsCookies();
  };

  const initializeAnalytics = () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", gaId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: CONSENT_MAX_AGE_SECONDS,
    });
    setAnalyticsLoaded(true);
  };

  if (!hydrated) return null;

  return (
    <>
      {analyticsEnabled && (
        <Script
          id="google-analytics-consented"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
          strategy="afterInteractive"
          onLoad={initializeAnalytics}
          onReady={initializeAnalytics}
        />
      )}

      {!consent && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          className="fixed inset-x-3 bottom-3 z-[250] mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-[0_24px_80px_rgba(2,12,27,0.32)] sm:inset-x-6 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#D96224]">
              <Cookie className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="cookie-banner-title" className="text-base font-black text-[#071829]">
                Sua privacidade importa
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Usamos armazenamento necessário para login, carrinho, segurança e funcionamento
                offline. Cookies de medição só serão ativados se você aceitar.
              </p>
              <Link
                href="/politica-de-cookies"
                className="mt-2 inline-flex text-xs font-bold text-[#B94F1E] underline underline-offset-4"
              >
                Ler a Política de Cookies
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => applyChoice(false)}
              className="min-h-12 rounded-2xl border-2 border-[#0B2540] px-4 py-3 text-sm font-black text-[#0B2540] transition hover:bg-slate-50"
            >
              Recusar opcionais
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftAnalytics(false);
                setSettingsOpen(true);
              }}
              className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Personalizar
            </button>
            <button
              type="button"
              onClick={() => applyChoice(true)}
              className="min-h-12 rounded-2xl bg-[#0B2540] px-4 py-3 text-sm font-black text-white transition hover:bg-[#12385E]"
            >
              Aceitar opcionais
            </button>
          </div>
        </section>
      )}

      {consent && (
        <button
          type="button"
          onClick={() => {
            setDraftAnalytics(consent.analytics);
            setSettingsOpen(true);
          }}
          className={`fixed right-3 z-[180] inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-[#071829] px-3.5 py-2 text-xs font-black text-white shadow-xl transition hover:bg-[#12385E] ${
            pathname.startsWith("/app") ? "bottom-24" : "bottom-3"
          }`}
          aria-label="Rever preferências de cookies"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Cookies
        </button>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[300] grid place-items-end bg-slate-950/60 p-3 backdrop-blur-sm sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSettingsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
            className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-800 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">
                  Central de privacidade
                </p>
                <h2 id="cookie-settings-title" className="mt-1 text-2xl font-black text-[#071829]">
                  Preferências de cookies
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Fechar preferências"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-black text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      Necessários
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Mantêm autenticação, segurança, carrinho, preferências e recursos offline.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-700 px-3 py-1 text-[10px] font-black uppercase text-white">
                    Sempre ativos
                  </span>
                </div>
              </article>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                <span>
                  <span className="block font-black text-slate-900">Medição e desempenho</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    Google Analytics para entender visitas às páginas públicas. Não mede a área
                    administrativa, o aplicativo, cadastro, contratos ou checkout.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draftAnalytics}
                  onChange={(event) => setDraftAnalytics(event.target.checked)}
                  className="h-6 w-6 shrink-0 accent-[#0B2540]"
                />
              </label>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              Você pode mudar esta escolha a qualquer momento. Consulte também os{" "}
              <Link href="/termos-de-uso" className="font-bold underline">Termos de Uso</Link>{" "}
              e a{" "}
              <Link href="/politica-de-cookies" className="font-bold underline">Política de Cookies</Link>.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => applyChoice(false)}
                className="min-h-12 rounded-2xl border-2 border-[#0B2540] px-4 py-3 text-sm font-black text-[#0B2540]"
              >
                Recusar opcionais
              </button>
              <button
                type="button"
                onClick={() => applyChoice(draftAnalytics)}
                className="min-h-12 rounded-2xl bg-[#0B2540] px-4 py-3 text-sm font-black text-white"
              >
                Salvar preferências
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
