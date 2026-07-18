"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

export type AsaasPaymentResult = {
  provider: "ASAAS";
  type: "PIX" | "CREDIT_CARD" | "BOLETO";
  paymentId: string;
  status?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  pixExpirationDate?: string | null;
  netAmount?: number;
  chargedAmount?: number;
};

export function AsaasPaymentStatus({
  payment,
  onConfirmed,
}: {
  payment: AsaasPaymentResult;
  onConfirmed: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(payment.status || "PENDING");
  const [message, setMessage] = useState("");
  const confirmedRef = useRef(false);

  const checkPayment = useCallback(async (quiet = false) => {
    if (confirmedRef.current) return;
    if (!quiet) setChecking(true);
    try {
      const response = await fetch(
        `/api/checkout-asaas/status?paymentId=${encodeURIComponent(payment.paymentId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao consultar pagamento");
      setStatus(String(result.status || "PENDING"));
      if (result.confirmed) {
        confirmedRef.current = true;
        setMessage("Pagamento confirmado pelo Asaas.");
        onConfirmed();
      } else if (["OVERDUE", "DELETED", "REFUNDED", "CHARGEBACK_REQUESTED"].includes(result.status)) {
        setMessage("Esta cobrança não está mais disponível. Gere um novo pagamento.");
      } else if (!quiet) {
        setMessage("O pagamento ainda está aguardando confirmação.");
      }
    } catch (error: any) {
      if (!quiet) setMessage(error.message || "Não foi possível consultar o pagamento.");
    } finally {
      if (!quiet) setChecking(false);
    }
  }, [onConfirmed, payment.paymentId]);

  useEffect(() => {
    const timer = window.setInterval(() => void checkPayment(true), 5000);
    return () => window.clearInterval(timer);
  }, [checkPayment]);

  const copyPix = async () => {
    if (!payment.pixCopyPaste) return;
    await navigator.clipboard.writeText(payment.pixCopyPaste);
    setMessage("Código Pix copiado.");
  };

  const chargedAmount = Number(payment.chargedAmount || payment.netAmount || 0);

  return (
    <div className="space-y-5 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E7EEF6] text-[#0B2540]">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-gray-900">Pagamento protegido pelo Asaas</p>
          <p className="mt-1 text-xs text-gray-500">
            A liberação acontece somente após a confirmação oficial do provedor.
          </p>
        </div>
      </div>

      {chargedAmount > 0 && (
        <div className="rounded-2xl bg-[#071829] px-4 py-3 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
            Total da cobrança
          </p>
          <p className="mt-1 text-2xl font-black">{formatCurrency(chargedAmount)}</p>
        </div>
      )}

      {payment.type === "PIX" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-56 w-56 items-center justify-center overflow-hidden rounded-3xl border border-gray-200 bg-white p-3">
            {payment.pixQrCode ? (
              <img
                src={`data:image/png;base64,${payment.pixQrCode}`}
                alt="QR Code Pix da cobrança Asaas"
                className="h-full w-full object-contain"
              />
            ) : (
              <QrCode className="h-20 w-20 text-gray-300" />
            )}
          </div>
          {payment.pixCopyPaste && (
            <button
              type="button"
              onClick={copyPix}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-[#E7EEF6] px-4 py-3.5 font-black text-[#0B2540]"
            >
              <Clipboard className="h-5 w-5" />
              Copiar código Pix
            </button>
          )}
        </div>
      )}

      {payment.type === "CREDIT_CARD" && payment.invoiceUrl && (
        <a
          href={payment.invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] px-4 py-4 font-black text-white"
        >
          <ExternalLink className="h-5 w-5" />
          Abrir pagamento com cartão
        </a>
      )}

      {payment.type === "BOLETO" && (payment.bankSlipUrl || payment.invoiceUrl) && (
        <a
          href={payment.bankSlipUrl || payment.invoiceUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2540] px-4 py-4 font-black text-white"
        >
          <FileText className="h-5 w-5" />
          Abrir boleto
        </a>
      )}

      <button
        type="button"
        onClick={() => void checkPayment(false)}
        disabled={checking || confirmedRef.current}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-bold text-gray-700 disabled:opacity-60"
      >
        {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "CONFIRMED" || status === "RECEIVED" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <RefreshCw className="h-5 w-5" />
        )}
        {checking ? "Verificando..." : "Já paguei, verificar agora"}
      </button>

      {message && (
        <p className="text-center text-xs font-bold text-gray-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
