"use client";

import Link from "next/link";
import { ChevronDown, ReceiptText, ShieldCheck } from "lucide-react";

type CancellationAcceptanceProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  dark?: boolean;
};

export function CancellationAcceptance({
  checked,
  onChange,
  dark = false,
}: CancellationAcceptanceProps) {
  return (
    <section className={`overflow-hidden rounded-2xl border ${
      dark ? "border-white/10 bg-white/5 text-white" : "border-amber-200 bg-amber-50 text-slate-800"
    }`}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            dark ? "bg-orange-400/15 text-orange-200" : "bg-amber-100 text-amber-700"
          }`}>
            <ReceiptText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm">Política de desistência e reembolso</strong>
            <span className={`mt-0.5 block text-[11px] ${dark ? "text-slate-400" : "text-slate-600"}`}>
              Leia como funcionam avisos de última hora e custos já contratados.
            </span>
          </span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className={`border-t p-4 text-xs leading-relaxed ${
          dark ? "border-white/10 text-slate-300" : "border-amber-200 text-slate-600"
        }`}>
          <ul className="space-y-2">
            <li><strong>Compra on-line:</strong> direito de arrependimento de sete dias quando aplicável o art. 49 do CDC.</li>
            <li><strong>Aviso com sete dias ou mais:</strong> remarcação disponível ou reembolso, descontando somente despesas diretas já assumidas e não recuperáveis.</li>
            <li><strong>Menos de sete dias, desistência no dia ou ausência sem aviso:</strong> podem ser descontados gastos reais da vaga com hospedagem, logística, transporte, entradas em parques, autorizações, reservas, seguro, alimentação e terceiros.</li>
            <li><strong>Garantia:</strong> os descontos devem ser proporcionais, comprováveis e nunca podem superar o valor pago. Todo saldo remanescente será devolvido.</li>
          </ul>
          <Link
            href="/termos-de-uso"
            target="_blank"
            className={`mt-3 inline-flex font-black underline underline-offset-2 ${
              dark ? "text-orange-200" : "text-amber-800"
            }`}
          >
            Abrir política completa
          </Link>
        </div>
      </details>

      <label className={`flex cursor-pointer items-start gap-3 border-t p-4 ${
        dark ? "border-white/10 bg-black/10" : "border-amber-200 bg-white/55"
      }`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#D96224]"
        />
        <span className="text-xs leading-relaxed">
          Li e aceito os Termos de Uso e a política de desistência, incluindo o possível
          desconto de despesas reais, individualizáveis e não recuperáveis em cancelamentos
          de última hora.
        </span>
        <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${checked ? "text-emerald-500" : "opacity-30"}`} />
      </label>
    </section>
  );
}
