import "server-only";

import {
  cancelAsaasPayment,
  createOrUpdateCustomer,
  createPayment,
  getPixQrCode,
} from "@/lib/asaas";
import { calculateGrossPrice, type AsaasPaymentMethod } from "@/lib/fees";

export type AsaasCheckoutMethod = Extract<
  AsaasPaymentMethod,
  "PIX" | "BOLETO" | "CREDIT_CARD"
>;

type Customer = {
  full_name: string;
  email: string;
  cpf: string;
  phone: string;
};

export function isAsaasCheckoutMethod(value: unknown): value is AsaasCheckoutMethod {
  return value === "PIX" || value === "BOLETO" || value === "CREDIT_CARD";
}

export async function createAsaasCharge(input: {
  client: Customer;
  method: AsaasCheckoutMethod;
  netAmount: number;
  absorbFee?: boolean;
  reference: string;
  description: string;
  postalCode?: string;
  addressNumber?: string;
}) {
  const netAmount = roundCurrency(input.netAmount);
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    throw new Error("Valor da cobrança inválido");
  }

  const customerId = await createOrUpdateCustomer({
    name: input.client.full_name,
    email: input.client.email,
    cpfCnpj: input.client.cpf,
    phone: input.client.phone,
    postalCode: input.postalCode,
    addressNumber: input.addressNumber,
  });
  const chargedAmount = input.absorbFee
    ? netAmount
    : calculateGrossPrice(netAmount, input.method, 1);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const payment = await createPayment({
    customer: customerId,
    billingType: input.method,
    dueDate: dueDate.toISOString().slice(0, 10),
    description: input.description.slice(0, 500),
    externalReference: input.reference.slice(0, 200),
    value: chargedAmount,
  });
  if (!payment?.id) throw new Error("Asaas não retornou o identificador da cobrança");

  const pix = input.method === "PIX"
    ? await getPixQrCode(String(payment.id))
    : null;

  return {
    payment,
    netAmount,
    chargedAmount,
    response: {
      success: true,
      provider: "ASAAS",
      type: input.method,
      paymentId: String(payment.id),
      status: String(payment.status || "PENDING"),
      invoiceUrl: payment.invoiceUrl || null,
      bankSlipUrl: payment.bankSlipUrl || null,
      pixQrCode: pix?.encodedImage || null,
      pixCopyPaste: pix?.payload || null,
      pixExpirationDate: pix?.expirationDate || null,
      netAmount,
      chargedAmount,
    },
  };
}

export async function safelyCancelAsaasPayment(paymentId: string | null) {
  if (!paymentId) return;
  try {
    await cancelAsaasPayment(paymentId);
  } catch (error) {
    console.error("Falha ao cancelar cobrança Asaas durante compensação:", error);
  }
}

function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
