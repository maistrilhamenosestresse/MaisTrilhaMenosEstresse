"use client";

import { useState } from "react";
import { CheckCircle2, FileSignature, Loader2, Mail, ShieldCheck } from "lucide-react";

export default function ContractAccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const requestAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/contracts/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível solicitar o acesso.");
      setMessage(result.message);
    } catch (requestError: any) {
      setError(requestError.message || "Não foi possível solicitar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#061526,#0B2540)] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-orange-300">
            <FileSignature className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-black">Termos e contratos</h1>
          <p className="mt-2 text-sm leading-relaxed text-blue-100/75">
            Consulte seus documentos ou faça o cadastro para assinar com segurança.
          </p>
        </div>

        <section className="rounded-[2rem] bg-white p-6 shadow-2xl">
          {message ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h2 className="mt-4 text-lg font-black text-slate-900">Verifique seu e-mail</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="mt-6 text-sm font-black text-[#0B2540]"
              >
                Informar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={requestAccess}>
              <div className="flex gap-3 rounded-2xl bg-[#E7EEF6] p-4 text-[#0B2540]">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Se você já tiver cadastro, receberá o acesso pessoal aos contratos. Se ainda não
                  tiver, enviaremos o link de cadastro com um tutorial rápido.
                </p>
              </div>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  E-mail do cadastro
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none"
                  />
                </div>
              </label>
              {error ? (
                <p className="mt-3 rounded-2xl bg-red-50 p-3 text-center text-xs font-bold text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96224] py-4 text-sm font-black text-white disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                Enviar instruções
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
