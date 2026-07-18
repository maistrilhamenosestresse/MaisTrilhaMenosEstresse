"use client";

import { useState } from "react";
import { ArrowLeft, BellRing, Loader2, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";

const categories = [
  { value: "new_trails", label: "Novas trilhas" },
  { value: "reservation_reminders", label: "Lembretes de reservas" },
  { value: "benefits", label: "Pontos e benefícios" },
];

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

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Destino dentro do app</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                maxLength={500}
                placeholder="/app/trilhas"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

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
