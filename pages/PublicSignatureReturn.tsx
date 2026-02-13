import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const PublicSignatureReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [signUrl, setSignUrl] = useState('');

  useEffect(() => {
    const check = async () => {
      if (!token) {
        setMessage('Token inválido.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/public/proposals/${token}/status`);
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          setMessage('Não foi possível consultar o status da assinatura.');
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const status = data?.status || '';
        if (status === 'signed' || status === 'paid' || status === 'payment_created') {
          navigate(`/pagamento/${token}`, { replace: true });
          return;
        }
        setSignUrl(data?.signatureUrl || '');
        setMessage('Assinatura ainda não confirmada.');
      } catch {
        setMessage('Erro ao consultar assinatura.');
      }
      setLoading(false);
    };
    check();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">Processando assinatura</h1>
        <p className="text-sm text-gray-500">{message}</p>
        {signUrl ? (
          <a
            href={signUrl}
            className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
          >
            Tentar novamente
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default PublicSignatureReturn;
