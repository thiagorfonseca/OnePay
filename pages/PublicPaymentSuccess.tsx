import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const PublicPaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState('Processando acesso...');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setMessage('Token inválido.');
        return;
      }
      const res = await fetch(`/api/auth/magic-link-after-payment?token=${token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setMessage(data?.error || 'Não foi possível gerar o acesso.');
        return;
      }
      window.location.href = data.url;
    };
    run();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
};

export default PublicPaymentSuccess;
