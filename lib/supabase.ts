/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const getEnv = (key: string): string => {
  // Vite (frontend)
  const viteEnv =
    (typeof import.meta !== 'undefined' ? ((import.meta as any).env as Record<string, string>) : undefined) || {};
  // Node (scripts/testes)
  const nodeEnv = (typeof process !== 'undefined' ? (process.env as Record<string, string>) : {}) || {};

  return (viteEnv[key] || nodeEnv[key] || '').trim();
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast: sem env correta, não deve gerar build/rodar apontando pra lugar errado
  throw new Error(
    'Config ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (frontend) em .env.local. ' +
      'Para scripts Node, use SUPABASE_URL e SUPABASE_ANON_KEY.'
  );
}

const browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: browserStorage,
    // storageKey pode ser fixo; se quiser separar staging/prod, dá pra anexar sufixo pelo hostname
    storageKey: 'sb-auth',
  },
});

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

// Cliente anon para rotas públicas (não herda sessão logada)
export const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: noopStorage,
    storageKey: 'sb-auth-public',
  },
});
