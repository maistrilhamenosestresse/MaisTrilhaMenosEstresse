"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Gift,
  Home,
  Loader2,
  Map,
  Settings,
  Send,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";

const categories = [
  { value: "new_trails", label: "Novas trilhas" },
  { value: "reservation_reminders", label: "Lembretes de reservas" },
  { value: "benefits", label: "Pontos e benefícios" },
];

const destinations = [
  { value: "/app", label: "Início do app", description: "Saldo, pontos e atalhos", icon: Home },
  { value: "/app/trilhas", label: "Comprar trilhas", description: "Próximas aventuras", icon: Map },
  { value: "/app/beneficios", label: "Pontos e benefícios", description: "Vantagens do cliente", icon: Gift },
  { value: "/app/loja", label: "Loja", description: "Produtos e equipamentos", icon: ShoppingBag },
  { value: "/app/extratos", label: "Extrato", description: "Compras e movimentações", icon: WalletCards },
  { value: "/app/configuracoes", label: "Configurações", description: "Notificações e instalação", icon: Settings },
] as const;

export default function AdminPushNotificationsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/app/trilhas");
  const [topic, setTopic] = useState("new_trails");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  const send = async () => {
    setSending(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url, topic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha no envio");
      setResult(`Enviado para ${data.sent} aparelho(s). ${data.failed || 0} falha(s).`);
      setTitle("");
      setBody("");
    } catch (error: any) {
      setResult(error.message || "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F7FA] p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mb-5 flex items-center gap-2 text-sm font-black text-[#0B2540]"
        >
          <ArrowLeft className="h-5 w-5" /> Voltar ao painel
        </button>

        <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <header className="bg-[linear-gradient(135deg,#071829,#0B2540)] p-6 text-white">
            <BellRing className="mb-4 h-9 w-9 text-orange-300" />
            <h1 className="text-2xl font-black">Enviar notificação ao aplicativo</h1>
            <p className="mt-2 text-sm text-blue-100/75">
              A mensagem aparece na barra do Android e nos iPhones que instalaram o app e autorizaram avisos.
            </p>
          </header>

          <div className="space-y-5 p-6">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Categoria</span>
              <select
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:ring-2 focus:ring-orange-300"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder="Ex.: Nova trilha disponível!"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Mensagem</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={240}
                rows={4}
                placeholder="Conte o benefício e dê um motivo claro para abrir o app."
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-orange-300"
              />
              <span className="mt-1 block text-right text-[10px] text-slate-400">{body.length}/240</span>
            </label>

            <fieldset>
              <legend className="text-xs font-black uppercase tracking-wider text-slate-500">
                Ao tocar, qual página deve abrir?
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {destinations.map((destination) => {
                  const Icon = destination.icon;
                  const selected = url === destination.value;
                  return (
                    <button
                      key={destination.value}
                      type="button"
                      onClick={() => setUrl(destination.value)}
                      aria-pressed={selected}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-[#D96224] bg-orange-50 ring-2 ring-orange-100"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        selected ? "bg-[#D96224] text-white" : "bg-white text-[#0B2540]"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-800">{destination.label}</span>
                        <span className="block text-xs text-slate-500">{destination.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex gap-3 rounded-2xl bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
              <Users className="h-5 w-5 shrink-0" />
              Somente pessoas que ativaram esta categoria receberão a mensagem.
            </div>

            {result ? <p className="text-center text-sm font-bold text-slate-700">{result}</p> : null}

            <button
              type="button"
              onClick={send}
              disabled={sending || title.trim().length < 3 || body.trim().length < 5}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96224] py-4 font-black text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Enviar notificação
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
