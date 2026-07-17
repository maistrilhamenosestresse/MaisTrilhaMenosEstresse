export type AsaasPaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';

const DISCOUNT_EXPIRATION = new Date('2026-10-15T00:00:00-03:00').getTime();

/**
 * Tarifas da conta consultadas em /v3/myAccount/fees em 17/07/2026.
 * Os valores promocionais expiram em 15/10/2026; depois disso o cálculo
 * troca automaticamente para as tarifas padrão informadas pela própria Asaas.
 */
export const ASAAS_FEES = {
  PIX: {
    standardFixed: 1.99,
    discountedFixed: 0.99,
  },
  BOLETO: {
    standardFixed: 1.99,
    discountedFixed: 0.99,
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

/**
 * Retorna o menor valor em centavos que, depois da tarifa da Asaas,
 * preserva o líquido definido pela empresa.
 */
export function calculateGrossPrice(
  netValue: number,
  method: AsaasPaymentMethod,
  installments = 1,
  now = new Date(),
) {
  const normalizedNet = roundCurrency(netValue);
  if (normalizedNet <= 0) return 0;

  const { fixedFee, percentFee } = getFeeComponents(method, installments, now);
  let grossCents = Math.max(
    1,
    Math.ceil((((normalizedNet + fixedFee) / (1 - percentFee)) * 100) - 1e-8),
  );

  while (
    grossCents > 1 &&
    calculateNetProfit((grossCents - 1) / 100, method, installments, now) >= normalizedNet
  ) {
    grossCents -= 1;
  }
  while (calculateNetProfit(grossCents / 100, method, installments, now) < normalizedNet) {
    grossCents += 1;
  }

  return grossCents / 100;
}

export function calculateNetProfit(
  grossValue: number,
  method: AsaasPaymentMethod,
  installments = 1,
  now = new Date(),
) {
  const normalizedGross = roundCurrency(grossValue);
  if (normalizedGross <= 0) return 0;
  const { fixedFee, percentFee } = getFeeComponents(method, installments, now);
  const percentageAmount = roundCurrency(normalizedGross * percentFee);
  return roundCurrency(normalizedGross - fixedFee - percentageAmount);
}

/**
 * Preço mínimo exibido antes da escolha do método: Pix à vista.
 * Se taxa_gratis for true, a organização optou por absorver a tarifa.
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
    return {
      fixedFee: discountActive
        ? ASAAS_FEES.PIX.discountedFixed
        : ASAAS_FEES.PIX.standardFixed,
      percentFee: 0,
    };
  }
  if (method === 'BOLETO') {
    const feePerSlip = discountActive
      ? ASAAS_FEES.BOLETO.discountedFixed
      : ASAAS_FEES.BOLETO.standardFixed;
    return { fixedFee: feePerSlip * normalizedInstallments, percentFee: 0 };
  }
  if (method === 'DEBIT_CARD') {
    return {
      fixedFee: ASAAS_FEES.DEBIT_CARD.fixed,
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
    percentFee: tier.percent,
  };
}

function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
