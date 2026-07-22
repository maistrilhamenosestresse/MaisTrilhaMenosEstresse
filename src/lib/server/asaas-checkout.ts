import "server-only";

import {
  cancelAsaasInstallmentPayments,
  cancelAsaasPayment,
  createOrUpdateCustomer,
  createPayment,
  getAsaasBankSlipAnticipationMonthlyRate,
  getAsaasInstallmentPayments,
  getPixQrCode,
} from "@/lib/asaas";
import {
  calculateGrossPrice,
  getAsaasFeeBreakdown,
  type AsaasPaymentMethod,
} from "@/lib/fees";

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
  installments?: number;
  postalCode?: string;
  addressNumber?: string;
}) {
  const netAmount = roundCurrency(input.netAmount);
  const installments = Math.max(1, Math.trunc(input.installments || 1));
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    throw new Error("Valor da cobrança inválido");
  }
  if (input.method !== "BOLETO" && installments !== 1) {
    throw new Error("Parcelamento disponível somente para boleto");
  }
  if (installments > 12) {
    throw new Error("O boleto aceita no máximo 12 parcelas");
  }

  const customerId = await createOrUpdateCustomer({
    name: input.client.full_name,
    email: input.client.email,
    cpfCnpj: input.client.cpf,
    phone: input.client.phone,
    postalCode: input.postalCode,
    addressNumber: input.addressNumber,
  });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const now = new Date();
  const anticipationMonthlyRatePercent = input.method === "BOLETO"
    ? await getAsaasBankSlipAnticipationMonthlyRate()
    : 0;
  const pricingOptions = {
    includeAnticipation: input.method === "BOLETO",
    anticipationMonthlyRatePercent,
    firstDueDate: dueDate,
  };
  const chargedAmount = input.absorbFee
    ? netAmount
    : calculateGrossPrice(netAmount, input.method, installments, now, pricingOptions);
  const feeBreakdown = getAsaasFeeBreakdown(
    chargedAmount,
    input.method,
    installments,
    now,
    pricingOptions,
  );

  const payment = await createPayment({
    customer: customerId,
    billingType: input.method,
    dueDate: dueDate.toISOString().slice(0, 10),
    description: input.description.slice(0, 500),
    externalReference: input.reference.slice(0, 200),
    ...(installments > 1
      ? { installmentCount: installments, totalValue: chargedAmount }
      : { value: chargedAmount }),
  });
  if (!payment?.id) throw new Error("Asaas não retornou o identificador da cobrança");

  const installmentId = payment.installment ? String(payment.installment) : null;
  const installmentPayments = installmentId
    ? await getAsaasInstallmentPayments(installmentId)
    : [];
  const payments = installmentPayments.length ? installmentPayments : [payment];

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
      paymentBookUrl: installmentId
        ? `/api/checkout-asaas/payment-book?paymentId=${encodeURIComponent(String(payment.id))}`
        : null,
      installmentId,
      installmentCount: installments,
      installmentValue: Number(payment.value || chargedAmount / installments),
      pixQrCode: pix?.encodedImage || null,
      pixCopyPaste: pix?.payload || null,
      pixExpirationDate: pix?.expirationDate || null,
      netAmount,
      chargedAmount,
      fees: {
        providerFee: feeBreakdown.providerFee,
        anticipationFee: feeBreakdown.anticipationFee,
        totalFees: feeBreakdown.totalFees,
        anticipatedNetAmount: feeBreakdown.netAmount,
        anticipationMonthlyRatePercent,
        anticipationDays: feeBreakdown.anticipationDays,
        absorbedByCompany: input.absorbFee === true,
      },
    },
    payments,
    installmentId,
  };
}

export async function safelyCancelAsaasPayment(
  paymentId: string | null,
  installmentId?: string | null,
) {
  if (!paymentId && !installmentId) return;
  try {
    if (installmentId) {
      await cancelAsaasInstallmentPayments(installmentId);
    } else if (paymentId) {
      await cancelAsaasPayment(paymentId);
    }
  } catch (error) {
    console.error("Falha ao cancelar cobrança Asaas durante compensação:", error);
  }
}

function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
