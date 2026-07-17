"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  FileSignature,
  Loader2,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { ContractContent } from "@/components/contracts/ContractContent";
import type { ContractDefinition, ContractType } from "@/lib/contracts";

type ContractRecord = {
  id: string;
  contract_type: ContractType;
  version: string;
  signature_url: string;
  signed_at: string;
  document_hash: string;
  document_snapshot: ContractDefinition;
};

export default function TermoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [definitions, setDefinitions] = useState<ContractDefinition[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/clients/${encodeURIComponent(id)}/term`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os contratos");
        setClient(result.client);
        setDefinitions(result.definitions || []);
        setContracts(result.contracts || []);
      } catch (loadError: any) {
        setError(loadError.message || "Não foi possível carregar os contratos");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-purple-600" />
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 flex items-center justify-center text-center">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 font-bold text-red-700">{error || "Cadastro não encontrado"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-3xl justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white"
        >
          <Printer className="h-4 w-4" /> Imprimir / salvar PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white print:rounded-none">
          <div className="flex items-center gap-3">
            <FileSignature className="h-8 w-8 text-orange-400" />
            <div>
              <h1 className="text-xl font-black">Documentos de segurança</h1>
              <p className="text-sm text-slate-300">Mais Trilha Menos Estresse</p>
            </div>
          </div>
          <div className="mt-5 grid gap-1 rounded-2xl bg-white/10 p-4 text-sm sm:grid-cols-2">
            <p><strong>Participante:</strong> {client.full_name}</p>
            <p><strong>CPF:</strong> {client.cpf}</p>
            <p><strong>Nascimento:</strong> {formatDate(client.birth_date)}</p>
            <p><strong>Telefone:</strong> {client.phone}</p>
          </div>
        </header>

        {definitions.map((definition) => {
          const contract = contracts.find((item) =>
            item.contract_type === definition.type && item.version === definition.version
          );
          const document = contract?.document_snapshot || definition;
          return (
            <section
              key={definition.type}
              className="break-after-page rounded-3xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              <ContractContent definition={document} />
              <div className="mt-8 border-t border-gray-200 pt-6">
                {contract ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                      Assinado em {new Date(contract.signed_at).toLocaleString("pt-BR")}
                    </div>
                    <img
                      src={contract.signature_url}
                      alt={`Assinatura de ${client.full_name}`}
                      className="mt-5 h-24 max-w-full object-contain"
                    />
                    <div className="mt-2 w-72 max-w-full border-t border-gray-900 pt-2 text-sm font-bold">
                      {client.full_name}
                    </div>
                    <p className="mt-4 break-all text-[10px] text-gray-500">
                      Hash do documento: {contract.document_hash}
                    </p>
                  </>
                ) : (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                    Esta versão ainda não foi assinada.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}
