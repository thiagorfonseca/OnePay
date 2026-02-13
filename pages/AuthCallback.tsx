import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const normalizeAuthError = (raw: string) => {
  const lower = raw.toLowerCase();
  if (lower.includes('code verifier') || lower.includes('code_verifier')) {
    return 'Link aberto em outro navegador/dispositivo. Solicite um novo link.';
  }
  if (lower.includes('invalid') || lower.includes('expired') || lower.includes('access_denied')) {
    return 'Link inválido ou expirado. Solicite um novo link.';
  }
  return raw;
};

const logDebug = (label: string, info: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.log(`[auth-callback] ${label}`, info);
  }
};

// Página de callback para OAuth e Magic Link (implicit ou PKCE).
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [message, setMessage] = useState<string>('Validando login...');

  useEffect(() => {
    const run = async () => {
      try {
        const current = new URL(window.location.href);
        const rawHash = current.hash.startsWith('#') ? current.hash.slice(1) : current.hash;
        const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
        const hashParams = new URLSearchParams(hashQuery);
        const redirectToParam = current.searchParams.get('redirectTo') || hashParams.get('redirectTo');

        // OAuth/Magic Link podem retornar code (PKCE) ou access_token (implicit).
        const code = current.searchParams.get('code') || hashParams.get('code');
        const errorParam =
          current.searchParams.get('error_description') ||
          current.searchParams.get('error') ||
          hashParams.get('error_description') ||
          hashParams.get('error');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        logDebug('params', {
          hasCode: Boolean(code),
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
          hasRedirectTo: Boolean(redirectToParam),
          errorParam,
        });

        if (errorParam) {
          setStatus('error');
          setMessage(normalizeAuthError(errorParam));
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setStatus('error');
            setMessage('Sessão de autenticação não encontrada. Solicite um novo link.');
            return;
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || null;
        let isSystemAdmin = false;
        if (userId) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          const role = prof?.role;
          isSystemAdmin = role === 'system_owner' || role === 'super_admin' || role === 'one_doctor_admin' || role === 'one_doctor_sales';
        }

        const safeRedirect =
          redirectToParam && redirectToParam.startsWith('/') && !redirectToParam.startsWith('//')
            ? redirectToParam
            : '/';

        setStatus('success');
        setMessage('Autenticado! Redirecionando...');
        navigate(isSystemAdmin ? '/admin/dashboard' : safeRedirect, { replace: true });
      } catch (err: any) {
        setStatus('error');
        setMessage(normalizeAuthError(err?.message || 'Erro ao validar login.'));
      }
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md text-center space-y-2">
        <div className="text-lg font-semibold">
          {status === 'loading' && 'Conectando...'}
          {status === 'success' && 'Sucesso!'}
          {status === 'error' && 'Algo deu errado'}
        </div>
        <p className="text-sm text-gray-600">{message}</p>
        {status === 'error' && (
          <button
            onClick={() => navigate('/login')}
            className="mt-3 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700"
          >
            Voltar para login
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
