import 'server-only';

import { requireServerEnv } from '@/lib/server/env';

type AsaasCustomerInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  postalCode?: string;
  addressNumber?: string;
};

export async function createOrUpdateCustomer(client: AsaasCustomerInput) {
  const cpfCnpj = String(client.cpfCnpj || '').replace(/\D/g, '');
  const phone = String(client.phone || '').replace(/\D/g, '');
  if (![11, 14].includes(cpfCnpj.length) || phone.length < 10) {
    throw new Error('CPF/CNPJ ou telefone inválido para pagamento');
  }

  const search = await asaasRequest(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
  const existing = Array.isArray(search.data) ? search.data[0] : null;
  const body = {
    name: client.name,
    email: client.email,
    cpfCnpj,
    phone,
    mobilePhone: phone,
    ...(client.postalCode ? { postalCode: client.postalCode } : {}),
    ...(client.addressNumber ? { addressNumber: client.addressNumber } : {}),
  };

  if (existing?.id) {
    await asaasRequest(`/customers/${existing.id}`, { method: 'POST', body: JSON.stringify(body) });
    return String(existing.id);
  }
  const created = await asaasRequest('/customers', { method: 'POST', body: JSON.stringify(body) });
  if (!created.id) throw new Error('Asaas não retornou o identificador do cliente');
  return String(created.id);
}

export async function createPayment(payload: Record<string, unknown>) {
  return asaasRequest('/payments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getPixQrCode(paymentId: string) {
  return asaasRequest(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
}

export async function getAsaasPayment(paymentId: string) {
  return asaasRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

async function asaasRequest(path: string, init: RequestInit = {}) {
  const baseUrl = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'access_token': requireServerEnv('ASAAS_API_KEY'),
      'User-Agent': 'MaisTrilha/1.0 (Next.js)',
      ...init.headers,
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = Array.isArray(data?.errors)
      ? data.errors.map((item: any) => item.description).filter(Boolean).join('; ')
      : data?.message;
    throw new Error(description || `Asaas respondeu com HTTP ${response.status}`);
  }
  return data;
}
