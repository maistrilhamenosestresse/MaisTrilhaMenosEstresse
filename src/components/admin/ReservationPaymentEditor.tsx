"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

type ReservationPaymentEditorProps = {
  reservation: any | null;
  onClose: () => void;
  onSaved: (reservation: any) => void;
};

const statuses = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "estornado", label: "Estornado" },
  { value: "expirado", label: "Expirado" },
];

const methods = [
  { value: "PIX", label: "Pix" },
  { value: "CREDIT_CARD", label: "Cartão" },
  { value: "PIX_INFINITEPAY", label: "Pix (InfinitePay)" },
  { value: "CREDIT_CARD_INFINITEPAY", label: "Cartão (InfinitePay)" },
  { value: "INFINITEPAY", label: "InfinitePay pendente" },
  { value: "BOLETO", label: "Boleto" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "CORTESIA", label: "Cortesia" },
  { value: "ASAAS", label: "Asaas" },
  { value: "SALDO_E_PONTOS", label: "Saldo e pontos" },
];

export function ReservationPaymentEditor({
  reservation,
  onClose,
  onSaved,
}: ReservationPaymentEditorProps) {
  const [status, setStatus] = useState("pendente");
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState("PIX");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    if (!reservation) return;
    setStatus(reservation.status_pagamento || "pendente");
    setAmount(String(Number(reservation.valor_pago || 0).toFixed(2)));
    setMethod(String(reservation.metodo_pagamento || "PIX").toUpperCase());
    setReason("");
    setError("");
    setWarning("");
  }, [reservation]);

  if (!reservation) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const response = await fetch(`/api/admin/reservations/${reservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_pagamento: status,
          valor_pago: Number(amount.replace(",", ".")),
          metodo_pagamento: method,
          motivo: reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao salvar");
      if (result.warning) {
        setWarning(result.warning);
        window.setTimeout(() => {
          onSaved(result.reservation);
          onClose();
        }, 1800);
        return;
      }
      onSaved(result.reservation);
      onClose();
    } catch (saveError: any) {
      setError(saveError.message || "Não foi possível atualizar a reserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/65 backdrop-blur-sm p-3 sm:p-6 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <header className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">
              Edição financeira
            </p>
            <h2 className="font-black text-gray-900 truncate">
              {reservation.clients?.full_name || "Reserva"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4">
          {reservation.nsu_transacao && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Esta reserva possui cobrança no Asaas. A edição abaixo corrige o registro interno,
                mas não cancela nem estorna a cobrança no Asaas.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-gray-500">
              Status do pagamento
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                Valor realmente pago
              </span>
              <div className="mt-2 flex items-center rounded-2xl border border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-orange-400">
                <span className="pl-4 text-sm font-black text-gray-500">R$</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-2 py-3.5 font-black text-gray-900 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                Forma recebida
              </span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
              >
                {methods.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-gray-500">
              Motivo da correção
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ex.: pagamento confirmado manualmente após conferência do extrato."
              className="mt-2 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
          </label>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          {warning && (
            <p className="text-sm font-bold text-amber-700 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {warning}
            </p>
          )}
        </div>

        <footer className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 font-black text-gray-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-[1.4] rounded-2xl bg-[#1D2A3A] py-3.5 font-black text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Salvar alteração
          </button>
        </footer>
      </div>
    </div>
  );
}
