import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const PublicPaymentPage: React.FC = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/proposals/${token}/status`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setData({ error: 'Não foi possível carregar o pagamento.' });
        return;
      }
      const body = await res.json().catch(() => ({}));
      setData(body);
    } catch {
      setData({ error: 'Erro ao carregar pagamento.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const invoiceUrl = data?.invoiceUrl || data?.payment?.invoice_url || '';
  const signatureUrl = data?.signatureUrl || '';
  const status = data?.status || data?.payment?.status || 'aguardando';
  const requiresSignature = Boolean(data?.proposal?.requires_signature);
  const isSigned = status === 'signed' || status === 'paid' || status === 'payment_created';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">Pagamento</h1>
        <p className="text-sm text-gray-500">Finalize o pagamento para liberar seu acesso.</p>
        {data?.error ? (
          <div className="text-sm text-rose-500">{data.error}</div>
        ) : (
          <>
            <div className="text-sm text-gray-600">
              Valor: {formatCurrency((data?.proposal?.amount_cents || 0) / 100)}
            </div>
            <div className="text-sm text-gray-600">Status: {status}</div>
          </>
        )}

        {!data?.error && requiresSignature && !isSigned ? (
          signatureUrl ? (
            <a
              href={signatureUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
            >
              Assinar contrato
            </a>
          ) : (
            <div className="text-sm text-gray-400">Assinatura pendente. Aguarde o link.</div>
          )
        ) : !data?.error && invoiceUrl ? (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
          >
            Ir para pagamento
          </a>
        ) : !data?.error ? (
          <div className="text-sm text-gray-400">Cobrança ainda não disponível.</div>
        ) : null}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <button type="button" onClick={load} className="hover:text-gray-600">Atualizar status</button>
          <Link to={`/pagamento/sucesso?token=${token}`} className="hover:text-gray-600">Já paguei</Link>
        </div>
      </div>
    </div>
  );
};

export default PublicPaymentPage;
