export type AsaasPaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';

const DISCOUNT_EXPIRATION = new Date('2026-10-15T00:00:00-03:00').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tarifas da conta consultadas em /v3/myAccount/fees em 22/07/2026.
 * O servidor consulta novamente a taxa de antecipacao no momento do checkout;
 * estes valores sao tambem o fallback usado na interface.
 */
export const ASAAS_FEES = {
  PIX: {
    standardFixed: 1.99,
    discountedFixed: 0.99,
  },
  BOLETO: {
    standardFixed: 1.99,
    discountedFixed: 0.99,
    anticipationMonthlyPercent: 5.79,
  },
  CREDIT_CARD: {
    fixed: 0.49,
    standardRates: [
      { maxInstallments: 1, percent: 0.0299 },
      { maxInstallments: 6, percent: 0.0349 },
      { maxInstallments: 12, percent: 0.0399 },
      { maxInstallments: 21, percent: 0.0429 },
    ],
    discountedRates: [
      { maxInstallments: 1, percent: 0.0199 },
      { maxInstallments: 6, percent: 0.0249 },
      { maxInstallments: 12, percent: 0.0299 },
      { maxInstallments: 21, percent: 0.0329 },
    ],
  },
  DEBIT_CARD: {
    fixed: 0.35,
    percent: 0.0189,
  },
} as const;

export type AsaasPricingOptions = {
  /** Considera que os boletos serao antecipados na data do checkout. */
  includeAnticipation?: boolean;
  /** Percentual mensal retornado por /v3/myAccount/fees. Ex.: 5.79. */
  anticipationMonthlyRatePercent?: number;
  /** Primeiro vencimento. As demais parcelas vencem mensalmente. */
  firstDueDate?: Date;
};

export type AsaasFeeBreakdown = {
  grossAmount: number;
  providerFee: number;
  anticipationFee: number;
  totalFees: number;
  netAmount: number;
  anticipationMonthlyRatePercent: number;
  anticipationDays: number[];
};

/**
 * Retorna o menor valor em centavos que preserva o liquido desejado depois
 * das tarifas de cobranca e da antecipacao prevista para cada boleto.
 */
export function calculateGrossPrice(
  netValue: number,
  method: AsaasPaymentMethod,
  installments = 1,
  now = new Date(),
  options: AsaasPricingOptions = {},
) {
  const normalizedNet = roundCurrency(netValue);
  if (normalizedNet <= 0) return 0;

  let lowCents = 1;
  let highCents = Math.max(100, Math.ceil(normalizedNet * 100));
  while (
    calculateNetProfit(highCents / 100, method, installments, now, options) < normalizedNet
  ) {
    highCents *= 2;
    if (highCents > 100_000_000_000) {
      throw new Error('Nao foi possivel calcular o valor final da cobranca');
    }
  }

  while (lowCents < highCents) {
    const middle = Math.floor((lowCents + highCents) / 2);
    if (calculateNetProfit(middle / 100, method, installments, now, options) >= normalizedNet) {
      highCents = middle;
    } else {
      lowCents = middle + 1;
    }
  }

  return lowCents / 100;
}

export function calculateNetProfit(
  grossValue: number,
  method: AsaasPaymentMethod,
  installments = 1,
  now = new Date(),
  options: AsaasPricingOptions = {},
) {
  return getAsaasFeeBreakdown(grossValue, method, installments, now, options).netAmount;
}

export function getAsaasFeeBreakdown(
  grossValue: number,
  method: AsaasPaymentMethod,
  installments = 1,
  now = new Date(),
  options: AsaasPricingOptions = {},
): AsaasFeeBreakdown {
  const normalizedGross = roundCurrency(grossValue);
  const normalizedInstallments = Math.max(1, Math.trunc(installments || 1));
  if (normalizedGross <= 0) {
    return {
      grossAmount: 0,
      providerFee: 0,
      anticipationFee: 0,
      totalFees: 0,
      netAmount: 0,
      anticipationMonthlyRatePercent: 0,
      anticipationDays: [],
    };
  }

  const { fixedFee, percentFee, fixedFeePerInstallment } = getFeeComponents(
    method,
    normalizedInstallments,
    now,
  );
  const percentageAmount = roundCurrency(normalizedGross * percentFee);
  const providerFee = roundCurrency(fixedFee + percentageAmount);
  let anticipationFee = 0;
  let anticipationDays: number[] = [];
  const anticipationMonthlyRatePercent = normalizeAnticipationRate(
    options.anticipationMonthlyRatePercent,
  );

  if (method === 'BOLETO' && options.includeAnticipation !== false) {
    const firstDueDate = options.firstDueDate || addCalendarDays(now, 1);
    const installmentValues = splitCurrency(normalizedGross, normalizedInstallments);
    anticipationDays = installmentValues.map((_, index) =>
      calendarDaysBetween(now, addCalendarMonths(firstDueDate, index))
    );
    anticipationFee = roundCurrency(installmentValues.reduce((total, installmentValue, index) => {
      const receivableValue = Math.max(0, installmentValue - fixedFeePerInstallment);
      const dailyProRata = anticipationDays[index] / 30;
      return total + roundCurrency(
        receivableValue * (anticipationMonthlyRatePercent / 100) * dailyProRata,
      );
    }, 0));
  }

  const totalFees = roundCurrency(providerFee + anticipationFee);
  return {
    grossAmount: normalizedGross,
    providerFee,
    anticipationFee,
    totalFees,
    netAmount: roundCurrency(Math.max(0, normalizedGross - totalFees)),
    anticipationMonthlyRatePercent: method === 'BOLETO'
      ? anticipationMonthlyRatePercent
      : 0,
    anticipationDays,
  };
}

/**
 * Preco minimo exibido antes da escolha do metodo: Pix a vista.
 * Se taxa_gratis for true, a organizacao optou por absorver a tarifa.
 */
export function getLowestGrossPrice(basePrice: number, taxa_gratis = false) {
  return taxa_gratis
    ? roundCurrency(basePrice)
    : calculateGrossPrice(basePrice, 'PIX');
}

function getFeeComponents(
  method: AsaasPaymentMethod,
  installments: number,
  now: Date,
) {
  const normalizedInstallments = Math.max(1, Math.trunc(installments || 1));
  const discountActive = now.getTime() < DISCOUNT_EXPIRATION;

  if (method === 'PIX') {
    const fixedFee = discountActive
      ? ASAAS_FEES.PIX.discountedFixed
      : ASAAS_FEES.PIX.standardFixed;
    return { fixedFee, fixedFeePerInstallment: fixedFee, percentFee: 0 };
  }
  if (method === 'BOLETO') {
    const feePerSlip = discountActive
      ? ASAAS_FEES.BOLETO.discountedFixed
      : ASAAS_FEES.BOLETO.standardFixed;
    return {
      fixedFee: feePerSlip * normalizedInstallments,
      fixedFeePerInstallment: feePerSlip,
      percentFee: 0,
    };
  }
  if (method === 'DEBIT_CARD') {
    return {
      fixedFee: ASAAS_FEES.DEBIT_CARD.fixed,
      fixedFeePerInstallment: ASAAS_FEES.DEBIT_CARD.fixed,
      percentFee: ASAAS_FEES.DEBIT_CARD.percent,
    };
  }

  const tiers = discountActive
    ? ASAAS_FEES.CREDIT_CARD.discountedRates
    : ASAAS_FEES.CREDIT_CARD.standardRates;
  const tier = tiers.find((item) => normalizedInstallments <= item.maxInstallments)
    || tiers[tiers.length - 1];
  return {
    fixedFee: ASAAS_FEES.CREDIT_CARD.fixed,
    fixedFeePerInstallment: ASAAS_FEES.CREDIT_CARD.fixed,
    percentFee: tier.percent,
  };
}

function normalizeAnticipationRate(rate: number | undefined) {
  const parsed = Number(rate);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : ASAAS_FEES.BOLETO.anticipationMonthlyPercent;
}

function splitCurrency(total: number, installments: number) {
  const totalCents = Math.round(total * 100);
  const regularCents = Math.floor(totalCents / installments);
  const remainder = totalCents - regularCents * installments;
  return Array.from({ length: installments }, (_, index) =>
    (regularCents + (index === installments - 1 ? remainder : 0)) / 100
  );
}

function addCalendarDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function addCalendarMonths(value: Date, months: number) {
  const result = new Date(value);
  const desiredDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(desiredDay, lastDay));
  return result;
}

function calendarDaysBetween(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / DAY_MS));
}

function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
