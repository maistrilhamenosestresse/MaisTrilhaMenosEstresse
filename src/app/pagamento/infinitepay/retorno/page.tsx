"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Loader2, ReceiptText, ShieldCheck, TriangleAlert } from "lucide-react";

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
        if (!response.ok) throw new Error(result.error || "Falha ao confirmar pagamento");
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
    check();
    return () => {
      active = false;
    };
  }, [orderNsu, receiptUrl, slug, transactionNsu]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 text-white p-5 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center shadow-2xl">
        {state === "paid" ? (
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        ) : state === "error" ? (
          <TriangleAlert className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        ) : (
          <Loader2 className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-spin" />
        )}

        <h1 className="text-2xl font-black mb-2">
          {state === "paid"
            ? "Pagamento confirmado!"
            : state === "error"
              ? "Confirmação pendente"
              : "Confirmando pagamento"}
        </h1>
        <p className="text-sm text-slate-300 mb-6">{message}</p>

        <div className="rounded-2xl bg-black/20 border border-white/10 p-4 mb-5 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            A liberação ocorre somente após consulta oficial à InfinitePay.
          </div>
        </div>

        {state === "paid" && confirmedReceiptUrl && (
          <a
            href={confirmedReceiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mb-3 rounded-2xl bg-white/10 hover:bg-white/15 py-3 px-4 font-bold flex items-center justify-center gap-2"
          >
            <ReceiptText className="w-5 h-5" /> Ver comprovante
          </a>
        )}

        {state === "paid" && invitations.length > 0 && (
          <div className="rounded-2xl bg-orange-500/10 border border-orange-400/20 p-4 mb-5 text-left">
            <h2 className="font-black text-orange-200 mb-2">Cadastro dos acompanhantes</h2>
            <div className="space-y-2">
              {invitations.map((invite) => (
                <button
                  key={invite.token}
                  onClick={() => {
                    const link = `${window.location.origin}/cadastro?invite=${encodeURIComponent(invite.token)}`;
                    navigator.clipboard.writeText(link);
                  }}
                  className="w-full rounded-xl bg-white/10 p-3 text-sm font-bold flex items-center justify-between"
                >
                  {invite.name} <Copy className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            window.sessionStorage.removeItem(`infinitepay:${orderNsu}:returnTo`);
            router.replace(returnTo);
          }}
          className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-4 font-black disabled:opacity-50"
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
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-300" />
      </main>
    }>
      <InfinitePayReturnContent />
    </Suspense>
  );
}
