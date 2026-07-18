"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type PersonalData = {
  full_name: string;
  rg: string;
  birth_date: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  health_notes: string;
  image_authorization: boolean;
};

const emptyForm: PersonalData = {
  full_name: "",
  rg: "",
  birth_date: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  health_notes: "",
  image_authorization: false,
};

export default function PersonalDataPage() {
  const router = useRouter();
  const [form, setForm] = useState<PersonalData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/clients/me", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Cadastro não encontrado.");
        const client = result.client || {};
        setForm({
          full_name: String(client.full_name || ""),
          rg: String(client.rg || ""),
          birth_date: String(client.birth_date || ""),
          phone: String(client.phone || ""),
          emergency_contact_name: String(client.emergency_contact_name || ""),
          emergency_contact_phone: String(client.emergency_contact_phone || ""),
          health_notes: String(client.health_notes || ""),
          image_authorization: client.image_authorization === true,
        });
      } catch (loadError: any) {
        setError(loadError.message || "Não foi possível carregar seus dados.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const update = <Key extends keyof PersonalData>(key: Key, value: PersonalData[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/clients/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setMessage("Dados pessoais atualizados com sucesso.");
    } catch (saveError: any) {
      setError(saveError.message || "Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-app-page flex min-h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D96224]" />
      </div>
    );
  }

  return (
    <div className="mt-app-page min-h-full pb-24">
      <header className="mt-app-header sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0B2540] shadow-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">Minha conta</p>
          <h1 className="text-lg font-black text-[#071829]">Dados pessoais</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl p-4 sm:p-6">
        <div className="mb-5 flex gap-3 rounded-3xl bg-[#E7EEF6] p-4 text-[#0B2540]">
          <UserRound className="h-5 w-5 shrink-0" />
          <p className="text-xs leading-relaxed">
            Mantenha seus contatos e informações de segurança atualizados para cada aventura.
          </p>
        </div>

        <form onSubmit={save} className="mt-surface space-y-4 rounded-[1.75rem] p-5">
          <Field label="Nome completo" required value={form.full_name} onChange={(value) => update("full_name", value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="RG" value={form.rg} onChange={(value) => update("rg", value)} />
            <Field label="Data de nascimento" type="date" value={form.birth_date} onChange={(value) => update("birth_date", value)} />
          </div>
          <Field label="Telefone" type="tel" value={form.phone} onChange={(value) => update("phone", value)} />

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Contato de emergência</p>
            <div className="space-y-4">
              <Field label="Nome do contato" value={form.emergency_contact_name} onChange={(value) => update("emergency_contact_name", value)} />
              <Field label="Telefone do contato" type="tel" value={form.emergency_contact_phone} onChange={(value) => update("emergency_contact_phone", value)} />
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Informações de saúde importantes</span>
            <textarea
              value={form.health_notes}
              onChange={(event) => update("health_notes", event.target.value)}
              rows={4}
              maxLength={3000}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              placeholder="Alergias, medicamentos ou condições que a equipe deve conhecer"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={form.image_authorization}
              onChange={(event) => update("image_authorization", event.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#D96224]"
            />
            <span className="text-xs leading-relaxed text-slate-700">
              Autorizo o uso da minha imagem conforme os termos e contratos assinados.
            </span>
          </label>

          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-center text-xs font-bold text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={saving || form.full_name.trim().length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Salvar dados pessoais
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}
