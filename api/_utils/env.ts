export const getEnv = (key: string): string => (process.env[key] || '').trim();

export const SUPABASE_URL = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
export const APP_BASE_URL = getEnv('APP_BASE_URL');

export const ZAPSIGN_API_TOKEN = getEnv('ZAPSIGN_API_TOKEN');
export const ZAPSIGN_WEBHOOK_SECRET = getEnv('ZAPSIGN_WEBHOOK_SECRET');

export const ASAAS_API_KEY = getEnv('ASAAS_API_KEY');
export const ASAAS_ENV = (getEnv('ASAAS_ENV') || 'sandbox') as 'sandbox' | 'prod';
export const ASAAS_WEBHOOK_TOKEN = getEnv('ASAAS_WEBHOOK_TOKEN');
export const ASAAS_SPLIT_WALLETS_JSON = getEnv('ASAAS_SPLIT_WALLETS_JSON');

export const RESEND_API_KEY = getEnv('RESEND_API_KEY');
export const RESEND_FROM = getEnv('RESEND_FROM');
