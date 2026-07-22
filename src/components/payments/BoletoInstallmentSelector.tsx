"use client";

import { calculateGrossPrice } from "@/lib/fees";

export const MAX_BOLETO_INSTALLMENTS = 12;

export function BoletoInstallmentSelector({
  netAmount,
  installments,
  onChange,
  absorbFee = false,
  dark = false,
}: {
  netAmount: number;
  installments: number;
  onChange: (installments: number) => void;
  absorbFee?: boolean;
  dark?: boolean;
}) {
  const totalFor = (count: number) =>
    absorbFee ? netAmount : calculateGrossPrice(netAmount, "BOLETO", count);

  return (
    <div className={`rounded-2xl border p-4 ${
      dark
        ? "border-white/10 bg-white/5 text-white"
        : "border-blue-100 bg-white text-gray-800"
    }`}>
      <label
        htmlFor="boleto-installments"
        className={`block text-[10px] font-black uppercase tracking-[0.14em] ${
          dark ? "text-blue-100" : "text-[#0B2540]"
        }`}
      >
        Parcelamento do boleto
      </label>
      <select
        id="boleto-installments"
        value={installments}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold outline-none ${
          dark
            ? "border-white/10 bg-[#0F1722] text-white focus:border-blue-300"
            : "border-gray-200 bg-gray-50 text-gray-800 focus:border-[#0B2540]"
        }`}
      >
        {Array.from({ length: MAX_BOLETO_INSTALLMENTS }, (_, index) => index + 1).map((count) => {
          const total = totalFor(count);
          return (
            <option key={count} value={count}>
              {count === 1
                ? `À vista — ${formatCurrency(total)}`
                : `${count}x de aproximadamente ${formatCurrency(total / count)}`}
            </option>
          );
        })}
      </select>
      <p className={`mt-2 text-[11px] ${dark ? "text-gray-400" : "text-gray-500"}`}>
        {installments === 1
          ? "Um boleto com vencimento no dia seguinte."
          : `Carnê com ${installments} boletos mensais. A última parcela pode ter ajuste de centavos.`}
      </p>
    </div>
  );
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
