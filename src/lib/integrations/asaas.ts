export type AsaasSplit = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

export type AsaasCustomerPayload = {
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type AsaasPaymentPayload = {
  customerId: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  installmentCount?: number;
  split?: AsaasSplit[];
  description?: string;
  dueDate?: string;
  externalReference?: string;
};

export type AsaasConfig = {
  apiKey: string;
  env?: 'sandbox' | 'prod';
};

const baseUrl = (env: 'sandbox' | 'prod') =>
  env === 'prod' ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';

const request = async (config: AsaasConfig, path: string, options: RequestInit = {}) => {
  const res = await fetch(`${baseUrl(config.env || 'sandbox')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: config.apiKey,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.errors?.[0]?.description || data?.message || 'Erro ao comunicar com Asaas';
    throw new Error(message);
  }
  return data;
};

export const ensureCustomer = async (config: AsaasConfig, payload: AsaasCustomerPayload) => {
  if (payload.cpfCnpj) {
    const search = await request(config, `/customers?cpfCnpj=${encodeURIComponent(payload.cpfCnpj)}`, {
      method: 'GET',
    });
    const existing = search?.data?.[0];
    if (existing) return existing;
  }
  if (payload.email) {
    const search = await request(config, `/customers?email=${encodeURIComponent(payload.email)}`, {
      method: 'GET',
    });
    const existing = search?.data?.[0];
    if (existing) return existing;
  }

  return request(config, '/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      cpfCnpj: payload.cpfCnpj,
      email: payload.email,
      mobilePhone: payload.mobilePhone,
      address: payload.address,
      addressNumber: payload.addressNumber,
      complement: payload.complement,
      province: payload.province,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
    }),
  });
};

export const createPayment = async (config: AsaasConfig, payload: AsaasPaymentPayload) => {
  return request(config, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: payload.customerId,
      billingType: payload.billingType,
      value: payload.value,
      installmentCount: payload.installmentCount,
      split: payload.split,
      description: payload.description,
      dueDate: payload.dueDate,
      externalReference: payload.externalReference,
    }),
  });
};

export const getPayment = async (config: AsaasConfig, paymentId: string) => {
  return request(config, `/payments/${paymentId}`, { method: 'GET' });
};
