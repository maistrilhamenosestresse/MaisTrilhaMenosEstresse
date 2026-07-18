import "server-only";

import { randomUUID } from "node:crypto";
import { createInfinitePayLink } from "@/lib/server/infinitepay";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireServerEnv } from "@/lib/server/env";

type CheckoutKind = "trail" | "store" | "recharge";

type Customer = {
  full_name: string;
  email: string;
  phone: string;
};

export async function createInfinitePayCheckout(input: {
  kind: CheckoutKind;
  reference: string;
  clientId: string;
  netAmount: number;
  description: string;
  customer: Customer;
}) {
  const supabase = createSupabaseAdmin();
  const orderNsu = randomUUID();
  const expectedAmountCents = Math.round(Number(input.netAmount) * 100);
  if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0) {
    throw new Error("Valor do checkout InfinitePay inválido");
  }

  const { error: insertError } = await supabase.from("infinitepay_checkouts").insert({
    id: orderNsu,
    order_nsu: orderNsu,
    kind: input.kind,
    reference: input.reference,
    client_id: input.clientId,
    expected_amount_cents: expectedAmountCents,
    status: "creating",
  });
  if (insertError) throw insertError;

  try {
    const publicBaseUrl = getPublicBaseUrl();
    const link = await createInfinitePayLink({
      orderNsu,
      redirectUrl: `${publicBaseUrl}/pagamento/infinitepay/retorno`,
      webhookUrl: `${publicBaseUrl}/api/webhooks/infinitepay`,
      customer: {
        name: input.customer.full_name,
        email: input.customer.email,
        phone_number: input.customer.phone,
      },
      items: [
        {
          quantity: 1,
          price: expectedAmountCents,
          description: input.description.slice(0, 150),
        },
      ],
    });

    const { error: updateError } = await supabase
      .from("infinitepay_checkouts")
      .update({
        checkout_url: link.url,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderNsu)
      .eq("status", "creating");
    if (updateError) throw updateError;

    return {
      orderNsu,
      redirectUrl: link.url,
      expectedAmountCents,
      netAmount: expectedAmountCents / 100,
    };
  } catch (error) {
    await supabase
      .from("infinitepay_checkouts")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderNsu)
      .neq("status", "paid");
    throw error;
  }
}

export async function failInfinitePayCheckout(orderNsu: string | null) {
  if (!orderNsu) return;
  await createSupabaseAdmin()
    .from("infinitepay_checkouts")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("order_nsu", orderNsu)
    .neq("status", "paid");
}

function getPublicBaseUrl() {
  const value = (
    process.env.INFINITEPAY_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    requireServerEnv("NEXT_PUBLIC_BASE_URL")
  ).replace(/\/+$/, "");
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("A URL pública da InfinitePay deve usar HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}
