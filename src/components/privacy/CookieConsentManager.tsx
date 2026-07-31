"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Check,
  Cookie,
  Globe2,
  LockKeyhole,
  Radio,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const COOKIE_NAME = "mt_cookie_consent";
const CONSENT_VERSION = 2;
const POLICY_VERSION = "2026.07.29-2";
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

type PrivacySignal = "gpc" | "dnt" | null;
type ConsentSource = "banner" | "settings" | "privacy_signal";

type ConsentPreferences = {
  version: number;
  policyVersion: string;
  receiptId: string;
  necessary: true;
  analytics: boolean;
  source: ConsentSource;
  privacySignal: PrivacySignal;
  decidedAt: string;
  expiresAt: string;
};

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }

  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    doNotTrack?: string;
  }
}

function ensureConsentQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => {
    window.dataLayer?.push(args);
  });
}

function setGoogleConsentDefault() {
  ensureConsentQueue();
  window.gtag?.("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    personalization_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500,
  });
  window.gtag?.("set", "ads_data_redaction", true);
  window.gtag?.("set", "allow_google_signals", false);
}

function updateGoogleConsent(analytics: boolean) {
  ensureConsentQueue();
  window.gtag?.("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    personalization_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  });
}

function detectPrivacySignal(): PrivacySignal {
  if (navigator.globalPrivacyControl === true) return "gpc";
  const dnt = navigator.doNotTrack || window.doNotTrack;
  return dnt === "1" || dnt === "yes" ? "dnt" : null;
}

function createReceiptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `mt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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
      || parsed.policyVersion !== POLICY_VERSION
      || parsed.necessary !== true
      || typeof parsed.analytics !== "boolean"
      || !parsed.receiptId
      || !parsed.decidedAt
      || !parsed.expiresAt
      || new Date(parsed.expiresAt).getTime() <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistConsent(
  analytics: boolean,
  source: ConsentSource,
  privacySignal: PrivacySignal,
) {
  const decidedAt = new Date();
  const value: ConsentPreferences = {
    version: CONSENT_VERSION,
    policyVersion: POLICY_VERSION,
    receiptId: createReceiptId(),
    necessary: true,
    analytics: privacySignal === "gpc" ? false : analytics,
    source: privacySignal === "gpc" ? "privacy_signal" : source,
    privacySignal,
    decidedAt: decidedAt.toISOString(),
    expiresAt: new Date(decidedAt.getTime() + CONSENT_MAX_AGE_SECONDS * 1000).toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("mt:consent-changed", {
    detail: { analytics: value.analytics, receiptId: value.receiptId },
  }));
  return value;
}

function removeAnalyticsCookies() {
  const hostname = window.location.hostname;
  const domainCandidates = ["", hostname, `.${hostname}`, ".maistrilhasmenosestresse.com"];
  const cookieNames = document.cookie
    .split(";")
    .map((item) => item.trim().split("=")[0])
    .filter((name) => (
      name === "_ga"
      || name.startsWith("_ga_")
      || name === "_gid"
      || name.startsWith("_gat")
      || name === "_gcl_au"
      || name.startsWith("_gcl_")
    ));

  for (const name of cookieNames) {
    for (const domain of domainCandidates) {
      const domainAttribute = domain ? `; Domain=${domain}` : "";
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

export default function CookieConsentManager({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const settingsRef = useRef<HTMLElement>(null);
  const analyticsInitializedRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [privacySignal, setPrivacySignal] = useState<PrivacySignal>(null);
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
  const gpcLocked = privacySignal === "gpc";

  useEffect(() => {
    setGoogleConsentDefault();
    const detectedSignal = detectPrivacySignal();
    let saved = readConsent();

    if (detectedSignal === "gpc" && saved?.analytics) {
      saved = persistConsent(false, "privacy_signal", detectedSignal);
    }

    setPrivacySignal(detectedSignal);
    setConsent(saved);
    setDraftAnalytics(saved?.analytics ?? false);
    updateGoogleConsent(Boolean(saved?.analytics && detectedSignal !== "gpc"));
    if (!saved?.analytics) removeAnalyticsCookies();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!consent) return;
    const enabled = Boolean(consent.analytics && analyticsAllowedOnRoute && !gpcLocked);
    updateGoogleConsent(enabled);
    if (!enabled) removeAnalyticsCookies();
  }, [analyticsAllowedOnRoute, consent, gpcLocked]);

  useEffect(() => {
    if (!analyticsEnabled || !analyticsLoaded || !window.gtag) return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [analyticsEnabled, analyticsLoaded, pathname]);

  useEffect(() => {
    if (!settingsOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = settingsRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [settingsOpen]);

  const applyChoice = (analytics: boolean, source: ConsentSource) => {
    const saved = persistConsent(analytics, source, privacySignal);
    setConsent(saved);
    setDraftAnalytics(saved.analytics);
    setSettingsOpen(false);
    updateGoogleConsent(saved.analytics);
    if (!saved.analytics) removeAnalyticsCookies();
  };

  const initializeAnalytics = () => {
    if (analyticsInitializedRef.current) return;
    analyticsInitializedRef.current = true;
    ensureConsentQueue();
    updateGoogleConsent(true);
    window.gtag?.("js", new Date());
    window.gtag?.("config", gaId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: CONSENT_MAX_AGE_SECONDS,
      cookie_flags: "SameSite=Lax;Secure",
    });
    setAnalyticsLoaded(true);
  };

  if (!hydrated) return null;

  return (
    <>
      {analyticsEnabled ? (
        <Script
          id="google-analytics-consented"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
          strategy="afterInteractive"
          onLoad={initializeAnalytics}
          onReady={initializeAnalytics}
        />
      ) : null}

      {!consent ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          className="fixed inset-x-3 bottom-3 z-[250] mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-slate-800 shadow-[0_28px_90px_rgba(2,12,27,0.36)] sm:inset-x-6"
        >
          <div className="h-1 bg-[linear-gradient(90deg,#0B2540,#D96224,#0B2540)]" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7EEF6] text-[#0B2540]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <ProtocolBadge label="Privacidade por padrão" />
                  <ProtocolBadge label="Consent Mode v2" />
                  <ProtocolBadge label="GPC" />
                </div>
                <h2 id="cookie-banner-title" className="mt-3 text-lg font-black text-[#071829]">
                  Você controla seus dados
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Recursos essenciais mantêm login, segurança e funcionamento offline. Medição de
                  audiência fica bloqueada até uma escolha positiva. Não usamos publicidade
                  personalizada nem vendemos dados.
                </p>
                {privacySignal ? (
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <Radio className="h-3.5 w-3.5" />
                    Sinal {privacySignal === "gpc" ? "Global Privacy Control" : "Do Not Track"} detectado.
                    {gpcLocked ? " A medição permanecerá desativada." : ""}
                  </p>
                ) : null}
                <Link
                  href="/politica-de-cookies"
                  className="mt-2 inline-flex text-xs font-bold text-[#B94F1E] underline underline-offset-4"
                >
                  Ver tecnologias, prazos e fornecedores
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => applyChoice(false, "banner")}
                className="min-h-12 rounded-2xl border-2 border-[#0B2540] px-4 py-3 text-sm font-black text-[#0B2540] transition hover:bg-slate-50"
              >
                Somente necessários
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftAnalytics(false);
                  setSettingsOpen(true);
                }}
                className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Configurar escolhas
              </button>
              <button
                type="button"
                onClick={() => applyChoice(true, "banner")}
                className="min-h-12 rounded-2xl bg-[#0B2540] px-4 py-3 text-sm font-black text-white transition hover:bg-[#12385E]"
              >
                {gpcLocked ? "Confirmar privacidade" : "Aceitar medição"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftAnalytics(consent.analytics);
            setSettingsOpen(true);
          }}
          className={`fixed left-3 z-[180] inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#071829] text-xs font-black text-white shadow-xl transition hover:bg-[#12385E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D96224]/30 sm:h-auto sm:w-auto sm:gap-2 sm:px-3.5 sm:py-2 ${
            pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname.startsWith("/agenda")
              ? "bottom-[calc(env(safe-area-inset-bottom)+7.5rem)]"
              : "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
          }`}
          aria-label="Rever preferências de privacidade"
          title="Configurações de privacidade"
        >
          <Settings2 className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Privacidade</span>
        </button>
      )}

      {settingsOpen ? (
        <div
          className="fixed inset-0 z-[300] grid place-items-end bg-slate-950/65 p-3 backdrop-blur-sm sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSettingsOpen(false);
          }}
        >
          <section
            ref={settingsRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white p-5 text-slate-800 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">
                  Centro de preferências
                </p>
                <h2 id="cookie-settings-title" className="mt-1 text-2xl font-black text-[#071829]">
                  Controle de privacidade
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Padrão inspirado nos princípios de consentimento da LGPD/GDPR, Google Consent
                  Mode v2 e sinais globais de privacidade.
                </p>
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

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <TechnologyCard icon={Globe2} label="Consent Mode v2" value="Ativo" />
              <TechnologyCard
                icon={Radio}
                label="Sinal do navegador"
                value={privacySignal ? privacySignal.toUpperCase() : "Não detectado"}
              />
              <TechnologyCard icon={LockKeyhole} label="Publicidade" value="Sempre bloqueada" />
            </div>

            {gpcLocked ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Seu navegador enviou Global Privacy Control. A opção de medição foi bloqueada
                  automaticamente neste aparelho.
                </p>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-black text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      Estritamente necessários
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Sessão, segurança, carrinho, atualização do PWA, mapas baixados e sua própria
                      escolha de privacidade.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-700 px-3 py-1 text-[10px] font-black uppercase text-white">
                    Sempre ativos
                  </span>
                </div>
              </article>

              <label className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${
                gpcLocked ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75" : "cursor-pointer border-slate-200"
              }`}>
                <span>
                  <span className="flex items-center gap-2 font-black text-slate-900">
                    <BarChart3 className="h-4 w-4 text-[#D96224]" />
                    Medição de audiência
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    Google Analytics nas páginas públicas. Não mede admin, aplicativo, cadastro,
                    contratos, login ou checkout. Prazo configurado: até 180 dias.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={gpcLocked ? false : draftAnalytics}
                  onChange={(event) => setDraftAnalytics(event.target.checked)}
                  disabled={gpcLocked}
                  className="h-6 w-6 shrink-0 accent-[#0B2540]"
                  aria-label="Permitir medição de audiência"
                />
              </label>

              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                  <LockKeyhole className="h-4 w-4 text-[#0B2540]" />
                  Publicidade e personalização
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  <code>ad_storage</code>, <code>ad_user_data</code>,{" "}
                  <code>ad_personalization</code> e personalização permanecem negados em todas as escolhas.
                </p>
              </article>
            </div>

            {consent ? (
              <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3 text-[11px] text-slate-500">
                <p className="font-bold text-slate-700">Comprovante local da escolha</p>
                <p className="mt-1 break-all">
                  ID {consent.receiptId} · política {consent.policyVersion} ·{" "}
                  {new Date(consent.decidedAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ) : null}

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              A recusa não reduz o acesso ao serviço. Você pode mudar ou retirar sua escolha com a
              mesma facilidade. Consulte os{" "}
              <Link href="/termos-de-uso" className="font-bold underline">Termos de Uso</Link>{" "}
              e a{" "}
              <Link href="/politica-de-cookies" className="font-bold underline">Política de Cookies</Link>.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => applyChoice(false, "settings")}
                className="min-h-12 rounded-2xl border-2 border-[#0B2540] px-4 py-3 text-sm font-black text-[#0B2540]"
              >
                Somente necessários
              </button>
              <button
                type="button"
                onClick={() => applyChoice(draftAnalytics, "settings")}
                className="min-h-12 rounded-2xl bg-[#0B2540] px-4 py-3 text-sm font-black text-white"
              >
                Salvar preferências
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ProtocolBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-600">
      {label}
    </span>
  );
}

function TechnologyCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cookie;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-[#0B2540]" />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-800">
        <Check className="h-3.5 w-3.5 text-emerald-600" /> {value}
      </p>
    </div>
  );
}
