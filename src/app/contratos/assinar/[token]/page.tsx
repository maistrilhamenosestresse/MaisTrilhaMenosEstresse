"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Eraser,
  FileSignature,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { ContractContent } from "@/components/contracts/ContractContent";
import {
  ResponsiveSignaturePad,
  type ResponsiveSignaturePadHandle,
} from "@/components/contracts/ResponsiveSignaturePad";
import type { ContractDefinition } from "@/lib/contracts";

export default function ContractInvitePage() {
  const { token } = useParams<{ token: string }>();
  const signatureRef = useRef<ResponsiveSignaturePadHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [definitions, setDefinitions] = useState<ContractDefinition[]>([]);
  const [client, setClient] = useState<{ full_name: string; cpf_masked: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/contracts/invite/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível abrir o link");
        setDefinitions(result.definitions || []);
        setClient(result.client || null);
      } catch (loadError: any) {
        setError(loadError.message || "Não foi possível abrir o link");
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const sign = async () => {
    if (!accepted || !signatureRef.current || signatureRef.current.isEmpty()) {
      setError("Leia os documentos, marque o aceite e desenhe sua assinatura.");
      return;
    }
    setSigning(true);
    setError("");
    try {
      const signatureBlob = await fetch(signatureRef.current.toDataUrl())
        .then((response) => response.blob());
      const formData = new FormData();
      formData.append("folder", "signatures");
      formData.append("file", new File([signatureBlob], "contratos-atualizados.png", {
        type: "image/png",
      }));
      const uploadResponse = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(upload.error || "Falha ao enviar a assinatura");

      const response = await fetch(`/api/contracts/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_url: upload.publicUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao registrar a assinatura");
      setCompleted(true);
    } catch (signError: any) {
      setError(signError.message || "Não foi possível assinar os documentos");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-orange-400" />
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-6 flex items-center justify-center text-center">
        <div className="max-w-md rounded-[2rem] bg-white p-8 shadow-xl">
          <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-500" />
          <h1 className="mt-5 text-2xl font-black text-gray-900">Documentos assinados</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Obrigado, {client?.full_name?.split(" ")[0]}. O termo de responsabilidade e a
            autorização do seguro foram registrados com sucesso.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-12">
      <header className="bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-orange-500/20 p-3 text-orange-300">
              <FileSignature className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-xl font-black">Contratos atualizados</h1>
              <p className="text-sm text-slate-300">Mais Trilha Menos Estresse</p>
            </div>
          </div>
          {client && (
            <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-bold">{client.full_name}</p>
              <p className="mt-1 text-slate-300">{client.cpf_masked}</p>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Atualizamos o contrato. Leia os dois documentos abaixo e assine uma vez para
          confirmar ambos.
        </div>

        {definitions.map((definition) => (
          <ContractContent
            key={definition.type}
            definition={definition}
            className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm"
          />
        ))}

        {error && definitions.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : definitions.length > 0 ? (
          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-black text-gray-900">Assinatura eletrônica</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border-2 border-dashed border-gray-300">
              <ResponsiveSignaturePad ref={signatureRef} height={240} />
            </div>
            <button
              type="button"
              onClick={() => signatureRef.current?.clear()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-black text-gray-500"
            >
              <Eraser className="h-4 w-4" /> Limpar assinatura
            </button>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-emerald-600"
              />
              <span className="text-xs leading-relaxed text-gray-700">
                Li e compreendi o termo de responsabilidade e a autorização do seguro,
                confirmo meus dados e aceito assinar eletronicamente.
              </span>
            </label>

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={sign}
              disabled={!accepted || signing || definitions.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white disabled:opacity-50"
            >
              {signing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Assinar os dois documentos
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
