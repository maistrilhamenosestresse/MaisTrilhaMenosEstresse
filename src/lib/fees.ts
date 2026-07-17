export const ASAAS_FEES = {
  PIX: {
    fixed: 0.99, // R$ 0,99 por cobrança (preço promocional válido até 15/10/2026)
    percent: 0,
    anticipation_per_month: 0, // PIX cai em segundos, sem antecipação
  },
  BOLETO: {
    fixed: 0.99, // R$ 0,99 por boleto pago (preço promocional válido até 15/10/2026)
    percent: 0,
    anticipation_per_month: 0.0579, // 5,79% ao mês (padrão Asaas para antecipação de boleto)
  },
  CREDIT_CARD: {
    fixed: 0.49, // R$ 0,49 por transação (exceto à vista que não cobra)
    rates: [
      { maxInstallments: 1,  percent: 0.0199, anticipation_per_month: 0.0125 }, // 1,99% + antecipação 1,25%/mês (32 dias ~ 1 mês)
      { maxInstallments: 6,  percent: 0.0249, anticipation_per_month: 0.0170 }, // 2,49% 2-6x + antecipação 1,7%/mês
      { maxInstallments: 12, percent: 0.0299, anticipation_per_month: 0.0170 }, // 2,99% 7-12x + antecipação 1,7%/mês
      { maxInstallments: 21, percent: 0.0329, anticipation_per_month: 0.0170 }, // 3,29% 13-21x + antecipação 1,7%/mês
    ]
  },
  DEBIT_CARD: {
    fixed: 0.35,    // R$ 0,35 por transação
    percent: 0.0189, // 1,89%
    anticipation_per_month: 0, // Débito cai em 3 dias úteis, sem antecipação configurada
  },
  // Notificações (Email+SMS, WhatsApp) — NÃO incluídas no repasse ao cliente
  // São custo operacional absorvido pelo negócio.
  NOTIFICATIONS: 0,
  WITHDRAWAL_FEE: 0,
};


/**
 * Calcula a taxa de antecipação média.
 */
export function getAverageAnticipationRate(installments: number, anticipationRatePerMonth: number): number {
  if (installments <= 1) return anticipationRatePerMonth;
  const averageMonths = (installments + 1) / 2;
  return anticipationRatePerMonth * averageMonths;
}

/**
 * 1. MODO REPASSE (Atual): 
 * O lojista define que quer ganhar X líquido.
 * O sistema calcula o preço Bruto (Gross) a ser cobrado do cliente, embutindo as taxas.
 */
export function calculateGrossPrice(netValue: number, method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD', installments: number = 1): number {
  if (netValue <= 0) return 0;
  
  let fixedFee = ASAAS_FEES.WITHDRAWAL_FEE + ASAAS_FEES.NOTIFICATIONS;
  let percentFee = 0;

  if (method === 'PIX') {
    fixedFee += ASAAS_FEES.PIX.fixed;
    percentFee += ASAAS_FEES.PIX.percent;
    percentFee += ASAAS_FEES.PIX.anticipation_per_month; 
  } else if (method === 'BOLETO') {
    // Boleto Parcelado (Carnê) multiplica as taxas fixas (R$ 1,99) pelo número de parcelas/boletos
    fixedFee += (ASAAS_FEES.BOLETO.fixed * installments);
    percentFee += ASAAS_FEES.BOLETO.percent;
    percentFee += getAverageAnticipationRate(installments, ASAAS_FEES.BOLETO.anticipation_per_month); 
  } else if (method === 'DEBIT_CARD') {
    fixedFee += ASAAS_FEES.DEBIT_CARD.fixed;
    percentFee += ASAAS_FEES.DEBIT_CARD.percent;
    percentFee += ASAAS_FEES.DEBIT_CARD.anticipation_per_month;
  } else if (method === 'CREDIT_CARD') {
    fixedFee += ASAAS_FEES.CREDIT_CARD.fixed;
    const tier = ASAAS_FEES.CREDIT_CARD.rates.find(t => installments <= t.maxInstallments) 
                 || ASAAS_FEES.CREDIT_CARD.rates[ASAAS_FEES.CREDIT_CARD.rates.length - 1];
    
    // Na faixa promocional à vista, a Asaas não cobra o fixo de R$0.49
    if (installments === 1) {
      fixedFee -= ASAAS_FEES.CREDIT_CARD.fixed;
    }

    percentFee += tier.percent;
    percentFee += getAverageAnticipationRate(installments, tier.anticipation_per_month);
  }

  if (percentFee >= 1) throw new Error("Taxas excedem 100%.");

  const grossValue = (netValue + fixedFee) / (1 - percentFee);
  return Math.ceil(grossValue);
}

/**
 * 2. MODO TAXA GRÁTIS (Novo):
 * O lojista define o preço Bruto (Gross) (ex: R$ 490).
 * O cliente paga R$ 490, e o sistema calcula quanto Líquido o lojista vai receber.
 */
export function calculateNetProfit(grossValue: number, method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD', installments: number = 1): number {
  if (grossValue <= 0) return 0;
  
  let fixedFee = ASAAS_FEES.WITHDRAWAL_FEE + ASAAS_FEES.NOTIFICATIONS;
  let percentFee = 0;

  if (method === 'PIX') {
    fixedFee += ASAAS_FEES.PIX.fixed;
    percentFee += ASAAS_FEES.PIX.percent;
    percentFee += ASAAS_FEES.PIX.anticipation_per_month; 
  } else if (method === 'BOLETO') {
    fixedFee += (ASAAS_FEES.BOLETO.fixed * installments);
    percentFee += ASAAS_FEES.BOLETO.percent;
    percentFee += getAverageAnticipationRate(installments, ASAAS_FEES.BOLETO.anticipation_per_month); 
  } else if (method === 'DEBIT_CARD') {
    fixedFee += ASAAS_FEES.DEBIT_CARD.fixed;
    percentFee += ASAAS_FEES.DEBIT_CARD.percent;
    percentFee += ASAAS_FEES.DEBIT_CARD.anticipation_per_month;
  } else if (method === 'CREDIT_CARD') {
    fixedFee += ASAAS_FEES.CREDIT_CARD.fixed;
    const tier = ASAAS_FEES.CREDIT_CARD.rates.find(t => installments <= t.maxInstallments) 
                 || ASAAS_FEES.CREDIT_CARD.rates[ASAAS_FEES.CREDIT_CARD.rates.length - 1];
                 
    if (installments === 1) {
      fixedFee -= ASAAS_FEES.CREDIT_CARD.fixed;
    }
    
    percentFee += tier.percent;
    percentFee += getAverageAnticipationRate(installments, tier.anticipation_per_month);
  }

  const feeAmount = (grossValue * percentFee) + fixedFee;
  const netValue = grossValue - feeAmount;
  return Number(netValue.toFixed(2));
}

/**
 * Pega o menor preço Bruto (normalmente Pix à vista).
 * O boolean taxa_gratis determina se o preço já é o valor final (taxa absorvida) ou repassado.
 */
export function getLowestGrossPrice(basePrice: number, taxa_gratis: boolean = false): number {
  if (taxa_gratis) {
    return Number(basePrice.toFixed(2)); // O cliente paga exatamente o valor base
  }
  // Se for repasse, calcula o gross via PIX para achar o menor preço de vitrine
  return calculateGrossPrice(basePrice, 'PIX', 1);
}
