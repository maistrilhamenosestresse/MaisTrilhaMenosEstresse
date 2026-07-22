"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Share,
  Smartphone,
  X,
} from "lucide-react";

const INSTALL_DISMISSED_KEY = "mt-pwa-install-dismissed";
const INSTALL_CONFIRMED_KEY = "mt-pwa-install-confirmed";
const NOTIFICATION_DISMISSED_SESSION_KEY = "mt-pwa-notification-dismissed";

const topicOptions = [
  {
    value: "new_trails",
    label: "Novas trilhas",
    description: "Saiba quando uma nova aventura abrir.",
  },
  {
    value: "reservation_reminders",
    label: "Lembretes de reserva",
    description: "Receba um aviso antes da sua trilha.",
  },
  {
    value: "benefits",
    label: "Pontos e benefícios",
    description: "Não perca recompensas e vantagens.",
  },
] as const;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  compact?: boolean;
};

export function PwaEngagementCard({ compact = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const [installConfirmed, setInstallConfirmed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [topics, setTopics] = useState<string[]>(topicOptions.map((item) => item.value));

  const pushSupported = useMemo(() => (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  ), []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const android = /android/i.test(navigator.userAgent);
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsIos(ios);
    setIsAndroid(android);
    setStandalone(installed);
    if (installed) localStorage.setItem(INSTALL_CONFIRMED_KEY, "1");
    setInstallConfirmed(installed || localStorage.getItem(INSTALL_CONFIRMED_KEY) === "1");
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
    setNotificationDismissed(sessionStorage.getItem(NOTIFICATION_DISMISSED_SESSION_KEY) === "1");
    setPlatformReady(true);
    if ("Notification" in window) setPermission(Notification.permission);

    try {
      const response = await fetch("/api/push/subscription", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível consultar as notificações.");
      const result = await response.json();
      setConfigured(result.configured === true);
      if (pushSupported) {
        const registration = await navigator.serviceWorker.ready;
        const current = await registration.pushManager.getSubscription();
        setSubscribed(Boolean(current));
      } else {
        setSubscribed(result.subscribed === true);
      }
    } catch (error: any) {
      setMessage(error.message || "Notificações indisponíveis agora.");
    } finally {
      setLoading(false);
    }
  }, [pushSupported]);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      localStorage.setItem(INSTALL_CONFIRMED_KEY, "1");
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      setInstallConfirmed(true);
      setStandalone(true);
      setInstallDismissed(false);
      setCompactOpen(true);
      setInstallPrompt(null);
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const displayModeChanged = (event: MediaQueryListEvent) => {
      if (event.matches) markInstalled();
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    displayMode.addEventListener?.("change", displayModeChanged);
    void refresh();
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
      displayMode.removeEventListener?.("change", displayModeChanged);
    };
  }, [refresh]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALL_CONFIRMED_KEY, "1");
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      setInstallConfirmed(true);
      setStandalone(true);
      setMessage("App instalado. Agora você pode ativar as notificações.");
    }
    setInstallPrompt(null);
  };

  const dismissInstallNotice = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setInstallDismissed(true);
    setCompactOpen(false);
  };

  const dismissNotificationNotice = () => {
    sessionStorage.setItem(NOTIFICATION_DISMISSED_SESSION_KEY, "1");
    setNotificationDismissed(true);
    setCompactOpen(false);
  };

  const sendTestNotification = async () => {
    const response = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível enviar a notificação de teste.");
    return result;
  };

  const subscribe = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (isIos && !standalone) {
        throw new Error("No iPhone, primeiro adicione o app à Tela de Início.");
      }
      if (!pushSupported) {
        throw new Error("Este navegador não oferece notificações Web Push.");
      }
      const configResponse = await fetch("/api/push/subscription", { cache: "no-store" });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) {
        throw new Error(config.error || "Notificações ainda não configuradas.");
      }
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        throw new Error("Permissão não concedida. Você pode alterar isso nas configurações do aparelho.");
      }

      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      const subscription = current || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      await saveSubscription(subscription, topics);
      setSubscribed(true);
      try {
        await sendTestNotification();
        setMessage("Pronto! Enviamos uma notificação de teste para este aparelho.");
      } catch (testError: any) {
        setMessage(`Notificações ativadas, mas o teste falhou: ${testError.message}`);
      }
    } catch (error: any) {
      setMessage(error.message || "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: current.endpoint }),
        });
        await current.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Notificações desativadas neste aparelho.");
    } catch {
      setMessage("Não foi possível desativar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const testNotification = async () => {
    setBusy(true);
    setMessage("");
    try {
      await sendTestNotification();
      setMessage("Teste enviado. Verifique a barra de notificações do aparelho.");
    } catch (testError: any) {
      setMessage(testError.message || "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (topic: string) => {
    const nextTopics = topics.includes(topic)
      ? topics.filter((item) => item !== topic)
      : [...topics, topic];
    if (nextTopics.length === 0) {
      setMessage("Mantenha ao menos uma categoria ou desative as notificações.");
      return;
    }
    setTopics(nextTopics);
    if (!subscribed) return;

    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (!current) throw new Error("Inscrição não encontrada neste aparelho.");
      await saveSubscription(current, nextTopics);
      setMessage("Preferências atualizadas.");
    } catch (error: any) {
      setMessage(error.message || "Não foi possível atualizar as preferências.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    if (!platformReady) return null;
    const installedForNotice = standalone || installConfirmed;

    if (installedForNotice) {
      if (loading || subscribed || notificationDismissed) return null;

      return (
        <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_10px_28px_rgba(11,37,64,0.08)]">
          <div className="flex items-center gap-2 p-2">
            <button
              type="button"
              onClick={() => setCompactOpen((open) => !open)}
              aria-expanded={compactOpen}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-[#D96224]">
                <Bell className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-[#071829]">Ative as notificações</span>
                <span className="block truncate text-[11px] text-slate-500">Receba vagas, lembretes e benefícios</span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${compactOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={dismissNotificationNotice}
              aria-label="Fechar aviso de notificações"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {compactOpen ? (
            <div className="space-y-3 border-t border-slate-100 bg-[#FFFBF7] p-4">
              <p className="text-xs leading-relaxed text-slate-600">
                Toque abaixo e permita os avisos do aplicativo. Em seguida enviaremos um teste para confirmar.
              </p>
              {message ? <p className="rounded-xl bg-white p-3 text-center text-xs font-bold text-slate-700">{message}</p> : null}
              {permission === "denied" ? (
                <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
                  O Android bloqueou os avisos. Abra as configurações do aplicativo e permita notificações.
                </p>
              ) : null}
              <button
                type="button"
                onClick={subscribe}
                disabled={busy || !configured || permission === "denied"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96224] py-3.5 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                Ativar e enviar teste
              </button>
            </div>
          ) : null}
        </section>
      );
    }

    if (installDismissed) return null;

    return (
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_10px_28px_rgba(11,37,64,0.08)]">
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setCompactOpen((open) => !open)}
            aria-expanded={compactOpen}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7EEF6] text-[#0B2540]">
              <Smartphone className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-[#071829]">Instale o aplicativo</span>
              <span className="block truncate text-[11px] text-slate-500">Acesso rápido e avisos de novas trilhas</span>
            </span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${compactOpen ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={dismissInstallNotice}
            aria-label="Fechar aviso de instalação"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {compactOpen ? (
          <div className="space-y-3 border-t border-slate-100 bg-[#F8FBFF] p-4">
            {isIos ? (
              <div className="rounded-2xl border border-sky-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
                <p className="font-black text-[#0B2540]">No iPhone:</p>
                <p className="mt-2 flex gap-2"><Share className="h-4 w-4 shrink-0 text-blue-600" /> Toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>
              </div>
            ) : installPrompt ? (
              <button
                type="button"
                onClick={install}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-3.5 text-sm font-black text-white"
              >
                <Download className="h-5 w-5" /> Instalar agora
              </button>
            ) : isAndroid ? (
              <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-slate-600">
                Abra o menu do Chrome e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.
              </p>
            ) : (
              <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-slate-600">
                Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.
              </p>
            )}
            <p className="text-center text-[10px] text-slate-400">
              Você pode fechar este aviso e continuar usando normalmente pelo navegador.
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  if (loading) {
    return (
      <div className="mt-surface flex min-h-28 items-center justify-center rounded-3xl">
        <Loader2 className="h-6 w-6 animate-spin text-[#D96224]" />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(145deg,#F8FBFF,#EEF5FC)] shadow-[0_14px_35px_rgba(11,37,64,0.08)]">
      <div className="bg-[linear-gradient(135deg,#071829,#0B2540)] p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            {subscribed ? <Bell className="h-6 w-6 text-orange-300" /> : <Smartphone className="h-6 w-6 text-orange-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
              Mais perto da aventura
            </p>
            <h2 className="mt-1 text-lg font-black">
              {subscribed
                ? "Notificações ativadas"
                : standalone
                  ? "Escolha os avisos que deseja receber"
                  : "Instale e não perca nenhuma trilha"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-blue-100/75">
              Novas vagas, lembretes e benefícios direto na tela do celular.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {isIos && !standalone ? (
          <div className="rounded-2xl border border-sky-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-black text-[#0B2540]">No iPhone são dois passos:</p>
            <ol className="mt-2 space-y-2 text-xs leading-relaxed">
              <li className="flex gap-2"><Share className="h-4 w-4 shrink-0 text-blue-600" /> Toque em Compartilhar no navegador.</li>
              <li className="flex gap-2"><Download className="h-4 w-4 shrink-0 text-blue-600" /> Escolha “Adicionar à Tela de Início”, abra o app pelo ícone e ative os avisos.</li>
            </ol>
          </div>
        ) : null}

        {!standalone && installPrompt ? (
          <button
            type="button"
            onClick={install}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E7EEF6] py-3.5 text-sm font-black text-[#0B2540]"
          >
            <Download className="h-5 w-5" /> Instalar app no celular
          </button>
        ) : null}

        {!compact || !subscribed ? (
          <div className="space-y-2">
            {topicOptions.map((option) => {
              const selected = topics.includes(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => void toggleTopic(option.value)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left disabled:opacity-60"
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${selected ? "bg-[#0B2540] text-white" : "bg-slate-100 text-transparent"}`}>
                    <Check className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-slate-800">{option.label}</span>
                    <span className="block text-[11px] text-slate-500">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!configured ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
            O servidor de notificações está sendo configurado.
          </p>
        ) : null}

        {message ? (
          <p aria-live="polite" className="text-center text-xs font-bold text-slate-600">{message}</p>
        ) : null}

        {subscribed ? (
          <button
            type="button"
            onClick={testNotification}
            disabled={busy || !configured}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96224] py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
            Enviar notificação de teste
          </button>
        ) : null}

        <button
          type="button"
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={busy || !configured || (isIos && !standalone) || (!subscribed && topics.length === 0)}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white disabled:opacity-50 ${
            subscribed ? "bg-slate-600" : "bg-[#D96224]"
          }`}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : subscribed ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {subscribed ? "Desativar neste aparelho" : "Ativar notificações"}
        </button>

        {permission === "denied" ? (
          <p className="text-center text-[11px] text-red-600">
            As notificações estão bloqueadas nas configurações do navegador ou do aparelho.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "desktop";
}

async function saveSubscription(subscription: PushSubscription, topics: string[]) {
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      topics,
      platform: detectPlatform(),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Falha ao salvar notificações.");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}
