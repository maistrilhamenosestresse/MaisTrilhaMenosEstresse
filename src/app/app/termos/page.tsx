"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  PenLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ContractContent } from "@/components/contracts/ContractContent";
import {
  ResponsiveSignaturePad,
  type ResponsiveSignaturePadHandle,
} from "@/components/contracts/ResponsiveSignaturePad";
import type { ContractDefinition, ContractType } from "@/lib/contracts";

type SignedContract = {
  id: string;
  contract_type: ContractType;
  version: string;
  title: string;
  signed_at: string;
};

export default function AppTermsPage() {
  const router = useRouter();
  const signatureRef = useRef<ResponsiveSignaturePadHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [definitions, setDefinitions] = useState<ContractDefinition[]>([]);
  const [contracts, setContracts] = useState<SignedContract[]>([]);
  const [activeContract, setActiveContract] = useState<ContractDefinition | null>(null);
  const [expanded, setExpanded] = useState<ContractType | null>("responsibility");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const loadContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/contracts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao carregar documentos");
      setDefinitions(result.definitions || []);
      setContracts(result.contracts || []);
    } catch (loadError: any) {
      setError(loadError.message || "Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const currentSignature = (definition: ContractDefinition) =>
    contracts.find(
      (contract) =>
        contract.contract_type === definition.type &&
        contract.version === definition.version,
    );

  const openSignature = (definition: ContractDefinition) => {
    setActiveContract(definition);
    setAccepted(false);
    setError("");
  };

  const signContract = async () => {
    if (!activeContract || !accepted) return;
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError("Desenhe sua assinatura antes de confirmar.");
      return;
    }

    setSigning(true);
    setError("");
    try {
      const dataUrl = signatureRef.current.toDataUrl();
      const signatureBlob = await fetch(dataUrl).then((response) => response.blob());
      const formData = new FormData();
      formData.append("folder", "signatures");
      formData.append("file", new File([signatureBlob], `${activeContract.type}-${activeContract.version}.png`, { type: "image/png" }));

      const uploadResponse = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Não foi possível enviar a assinatura.");

      const contractResponse = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_type: activeContract.type,
          signature_url: uploadResult.publicUrl,
        }),
      });
      const result = await contractResponse.json();
      if (!contractResponse.ok) throw new Error(result.error || "Falha ao registrar assinatura");

      setContracts((current) => [
        result.contract,
        ...current.filter((contract) => contract.id !== result.contract.id),
      ]);
      setActiveContract(null);
      setAccepted(false);
    } catch (signError: any) {
      setError(signError.message || "Não foi possível assinar o documento.");
    } finally {
      setSigning(false);
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
    <div className="mt-app-page min-h-full pb-8">
      <header className="mt-app-header sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="min-w-0">
          <h1 className="font-black text-gray-900">Termos e contratos</h1>
          <p className="text-xs text-gray-500">Seus aceites e contratos assinados</p>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto">
        <section className="rounded-[1.75rem] bg-[linear-gradient(145deg,#061526,#0B2540)] p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="font-black text-lg">Central de segurança</h2>
              <p className="mt-1 text-sm leading-relaxed text-blue-100/80">
                Leia cada documento, assine as versões atualizadas e baixe sua cópia em PDF.
              </p>
            </div>
          </div>
        </section>

        {definitions.some((definition) => !currentSignature(definition)) && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-amber-900">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm">Atualizamos os documentos</p>
              <p className="text-xs mt-1 leading-relaxed">
                Leia as versões atuais e assine novamente para manter seu cadastro regularizado.
              </p>
            </div>
          </div>
        )}

        <section className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-black text-gray-900">Termos de uso do aplicativo</h2>
              <p className="text-xs text-gray-500">Regras gerais para uso da plataforma</p>
            </div>
          </div>
          <div className="p-5 text-sm text-gray-600 leading-relaxed space-y-3">
            <p>
              O aplicativo permite consultar trilhas, realizar compras, administrar benefícios,
              acessar álbuns e manter documentos de segurança. A conta é pessoal e o usuário deve
              proteger suas credenciais e manter os dados cadastrais corretos.
            </p>
            <p>
              Pix e cartão são processados pela InfinitePay; boleto é processado pelo Asaas. Saldo e pontos seguem as regras mostradas
              na tela de pagamento; valores reservados são devolvidos quando um pagamento não é concluído ou
              quando o fluxo de cancelamento aplicável determina a devolução.
            </p>
            <p>
              Fotos e vídeos do álbum ficam em infraestrutura AWS. Textos, cadastros e registros
              operacionais ficam no Supabase, com acesso conforme autenticação e autorização.
            </p>
            <p>
              O usuário deve respeitar direitos autorais, privacidade de terceiros, regras das
              atividades e orientações de segurança. Uso indevido, fraude ou tentativa de acesso
              não autorizado poderá causar bloqueio e adoção das medidas cabíveis.
            </p>
            <a
              href="/termos-de-uso"
              target="_blank"
              rel="noreferrer"
              className="inline-flex font-black text-blue-600"
            >
              Ver termos gerais completos
            </a>
          </div>
        </section>

        {definitions.map((definition) => {
          const signed = currentSignature(definition);
          const isExpanded = expanded === definition.type;
          return (
            <section key={definition.type} className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : definition.type)}
                className="w-full p-5 flex items-center gap-3 text-left"
              >
                <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  signed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {signed ? <FileCheck2 className="w-6 h-6" /> : <PenLine className="w-6 h-6" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-gray-900 leading-tight">{definition.title}</span>
                  <span className={`block text-xs mt-1 font-bold ${signed ? "text-emerald-600" : "text-amber-600"}`}>
                    {signed
                      ? `Assinado em ${new Date(signed.signed_at).toLocaleDateString("pt-BR")}`
                      : "Assinatura necessária"}
                  </span>
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 p-5">
                  <div className="md:max-h-[48dvh] md:overflow-y-auto md:pr-1 custom-scrollbar">
                    <ContractContent definition={definition} showVersion={false} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => openSignature(definition)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-3.5 font-black text-white"
                    >
                      <PenLine className="w-5 h-5" />
                      {signed ? "Assinar novamente" : "Ler e assinar"}
                    </button>
                    {signed && (
                      <a
                        href={`/api/contracts/${definition.type}/pdf`}
                        className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 py-3.5 font-black flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Baixar PDF assinado
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {error && !activeContract && (
          <p className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">{error}</p>
        )}
      </main>

      {activeContract && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-3 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[94dvh] flex flex-col">
            <header className="p-5 border-b border-gray-100 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">
                  Versão {activeContract.version}
                </p>
                <h2 className="font-black text-gray-900 truncate">Assinar documento</h2>
              </div>
              <button type="button" onClick={() => setActiveContract(null)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </header>

            <div className="p-5 overflow-y-auto">
              <p className="font-black text-gray-900 text-sm">{activeContract.title}</p>
              <p className="text-xs text-gray-500 mt-2">
                Ao assinar, você confirma que leu o conteúdo exibido nesta página.
              </p>

              <div className="mt-5 rounded-2xl border-2 border-dashed border-gray-300 bg-white overflow-hidden">
                <ResponsiveSignaturePad
                  ref={signatureRef}
                  height={220}
                />
              </div>
              <button
                type="button"
                onClick={() => signatureRef.current?.clear()}
                className="mt-2 text-xs font-black text-gray-500"
              >
                Limpar assinatura
              </button>

              <label className="mt-5 flex items-start gap-3 rounded-2xl bg-gray-50 border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#F17B37]"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  Li e compreendi o documento, confirmo a veracidade dos meus dados e aceito assinar eletronicamente.
                </span>
              </label>
              {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
            </div>

            <footer className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button type="button" onClick={() => setActiveContract(null)} className="flex-1 rounded-2xl bg-white border border-gray-200 py-3.5 font-black text-gray-600">
                Cancelar
              </button>
              <button
                type="button"
                onClick={signContract}
                disabled={!accepted || signing}
                className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#0B2540] py-3.5 font-black text-white disabled:opacity-50"
              >
                {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Confirmar assinatura
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
