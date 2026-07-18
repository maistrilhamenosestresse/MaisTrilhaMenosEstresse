import "server-only";

import { requireServerEnv } from "@/lib/server/env";

const DEFAULT_API_URL = "https://api.checkout.infinitepay.io";
const CHECKOUT_HOSTS = new Set([
  "checkout.infinitepay.com.br",
  "checkout.infinitepay.io",
]);

type InfinitePayItem = {
  quantity: number;
  price: number;
  description: string;
};

type InfinitePayCustomer = {
  name?: string;
  email?: string;
  phone_number?: string;
};

export type InfinitePayPaymentCheck = {
  success: boolean;
  paid: boolean;
  amount: number;
  paid_amount: number;
  installments: number;
  capture_method: "pix" | "credit_card";
};

export function getInfinitePayHandle() {
  const handle = requireServerEnv("INFINITEPAY_HANDLE")
    .replace(/^\\?(?=\$)/, "")
    .replace(/^\$/, "")
    .trim();
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(handle)) {
    throw new Error("InfiniteTag inválida");
  }
  return handle;
}

export async function createInfinitePayLink(input: {
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  items: InfinitePayItem[];
  customer?: InfinitePayCustomer;
}) {
  if (!input.orderNsu || !input.items.length) {
    throw new Error("Pedido InfinitePay inválido");
  }

  const items = input.items.map((item) => ({
    quantity: Math.max(1, Math.trunc(item.quantity)),
    price: Math.trunc(item.price),
    description: String(item.description || "").trim().slice(0, 150),
  }));
  if (items.some((item) => item.price <= 0 || !item.description)) {
    throw new Error("Itens InfinitePay inválidos");
  }

  const response = await infinitePayRequest("/links", {
    handle: getInfinitePayHandle(),
    redirect_url: assertPublicHttpsUrl(input.redirectUrl),
    webhook_url: assertPublicHttpsUrl(input.webhookUrl),
    order_nsu: input.orderNsu,
    items,
    ...(input.customer
      ? {
          customer: {
            name: String(input.customer.name || "").trim().slice(0, 150),
            email: String(input.customer.email || "").trim().toLowerCase().slice(0, 254),
            phone_number: normalizePhone(input.customer.phone_number),
          },
        }
      : {}),
  });

  const checkoutUrl = new URL(String(response.url || ""));
  if (checkoutUrl.protocol !== "https:" || !CHECKOUT_HOSTS.has(checkoutUrl.hostname)) {
    throw new Error("InfinitePay retornou uma URL de checkout inválida");
  }
  return { url: checkoutUrl.toString() };
}

export async function checkInfinitePayPayment(input: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<InfinitePayPaymentCheck> {
  const data = await infinitePayRequest("/payment_check", {
    handle: getInfinitePayHandle(),
    order_nsu: input.orderNsu,
    transaction_nsu: input.transactionNsu,
    slug: input.slug,
  });

  const captureMethod = String(data.capture_method || "");
  const result: InfinitePayPaymentCheck = {
    success: data.success === true,
    paid: data.paid === true,
    amount: Number(data.amount),
    paid_amount: Number(data.paid_amount),
    installments: Number(data.installments || 1),
    capture_method: captureMethod as InfinitePayPaymentCheck["capture_method"],
  };
  if (
    !Number.isInteger(result.amount) ||
    !Number.isInteger(result.paid_amount) ||
    result.amount <= 0 ||
    result.paid_amount < result.amount ||
    !Number.isInteger(result.installments) ||
    result.installments < 1 ||
    result.installments > 12 ||
    !["pix", "credit_card"].includes(captureMethod)
  ) {
    throw new Error("Resposta de pagamento inválida da InfinitePay");
  }
  return result;
}

async function infinitePayRequest(path: string, body: Record<string, unknown>) {
  const baseUrl = String(process.env.INFINITEPAY_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const parsedBaseUrl = new URL(baseUrl);
  if (
    parsedBaseUrl.protocol !== "https:" ||
    parsedBaseUrl.hostname !== "api.checkout.infinitepay.io"
  ) {
    throw new Error("Endpoint da InfinitePay inválido");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MaisTrilhaMenosEstresse/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let data: Record<string, any> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`InfinitePay respondeu com HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(
      String(data.message || data.error || `InfinitePay respondeu com HTTP ${response.status}`),
    );
  }
  return data;
}

function assertPublicHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("URL pública da InfinitePay deve usar HTTPS");
  }
  return url.toString();
}

function normalizePhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}
