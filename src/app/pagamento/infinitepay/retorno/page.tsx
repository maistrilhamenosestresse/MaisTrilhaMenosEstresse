"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Loader2,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type PaymentState = "checking" | "paid" | "pending" | "error";

function InfinitePayReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNsu = searchParams.get("order_nsu") || "";
  const transactionNsu = searchParams.get("transaction_nsu") || "";
  const slug = searchParams.get("slug") || "";
  const receiptUrl = searchParams.get("receipt_url") || "";
  const [state, setState] = useState<PaymentState>("checking");
  const [message, setMessage] = useState("Confirmando seu pagamento com a InfinitePay...");
  const [confirmedReceiptUrl, setConfirmedReceiptUrl] = useState("");

  const invitations = useMemo(() => {
    if (typeof window === "undefined" || !orderNsu) return [];
    try {
      return JSON.parse(
        window.sessionStorage.getItem(`infinitepay:${orderNsu}:invitations`) || "[]",
      ) as Array<{ name: string; token: string }>;
    } catch {
      return [];
    }
  }, [orderNsu]);
  const returnTo = useMemo(() => {
    if (typeof window === "undefined" || !orderNsu) return "/";
    return window.sessionStorage.getItem(`infinitepay:${orderNsu}:returnTo`) || "/";
  }, [orderNsu]);

  useEffect(() => {
    if (!orderNsu) {
      setState("error");
      setMessage("Não encontramos o identificador deste pagamento.");
      return;
    }

    let active = true;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/checkout-infinitepay/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_nsu: orderNsu,
            transaction_nsu: transactionNsu,
            slug,
            receipt_url: receiptUrl,
          }),
        });
        const result = await response.json();
        if (!active) return;
        if (!response.ok) {
          throw new Error(result.error || "Falha ao confirmar pagamento");
        }
        if (result.paid) {
          setState("paid");
          setMessage("Pagamento confirmado. Sua compra já foi liberada.");
          setConfirmedReceiptUrl(String(result.receiptUrl || ""));
          return;
        }
        setState("pending");
        setMessage("O pagamento ainda está sendo confirmado. Aguarde alguns segundos.");
      } catch (error: any) {
        if (!active) return;
        setState(attempts >= 5 ? "error" : "pending");
        setMessage(error.message || "Não foi possível confirmar o pagamento agora.");
      }

      if (active && attempts < 5) {
        window.setTimeout(check, 3000);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [orderNsu, receiptUrl, slug, transactionNsu]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,#061526,#0B2540)] p-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-xl">
        {state === "paid" ? (
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
        ) : state === "error" ? (
          <TriangleAlert className="mx-auto mb-4 h-16 w-16 text-amber-400" />
        ) : (
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-orange-300" />
        )}

        <h1 className="mb-2 text-2xl font-black">
          {state === "paid"
            ? "Pagamento confirmado!"
            : state === "error"
              ? "Confirmação pendente"
              : "Confirmando pagamento"}
        </h1>
        <p className="mb-6 text-sm text-slate-300">{message}</p>

        <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            A liberação ocorre somente após consulta oficial à InfinitePay.
          </div>
        </div>

        {state === "paid" && confirmedReceiptUrl && (
          <a
            href={confirmedReceiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-bold hover:bg-white/15"
          >
            <ReceiptText className="h-5 w-5" /> Ver comprovante
          </a>
        )}

        {state === "paid" && invitations.length > 0 && (
          <div className="mb-5 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-left">
            <h2 className="mb-2 font-black text-orange-200">Cadastro dos acompanhantes</h2>
            <div className="space-y-2">
              {invitations.map((invite) => (
                <button
                  type="button"
                  key={invite.token}
                  onClick={() => {
                    const link = `${window.location.origin}/cadastro?invite=${encodeURIComponent(invite.token)}`;
                    void navigator.clipboard.writeText(link);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-white/10 p-3 text-sm font-bold"
                >
                  {invite.name} <Copy className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(`infinitepay:${orderNsu}:returnTo`);
            router.replace(returnTo);
          }}
          className="w-full rounded-2xl bg-[#F17B37] py-4 font-black disabled:opacity-50"
          disabled={state === "checking"}
        >
          {state === "paid" ? "Continuar" : "Voltar ao Mais Trilha"}
        </button>
      </section>
    </main>
  );
}

export default function InfinitePayReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#071829] text-white">
          <Loader2 className="h-10 w-10 animate-spin text-orange-300" />
        </main>
      }
    >
      <InfinitePayReturnContent />
    </Suspense>
  );
}
