import React, { useEffect, useState } from 'react';
import SectionHeader from '../components/inventory/SectionHeader';
import { useAuth } from '../src/auth/AuthProvider';
import { listInsights } from '../src/lib/inventory/service';

const InventoryInsights: React.FC = () => {
  const { effectiveClinicId, session } = useAuth();
  const clinicId = effectiveClinicId;
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const load = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await listInsights(clinicId);
      setInsights(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clinicId]);

  const generateInsight = async () => {
    if (!clinicId || !session) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clinic_id: clinicId }),
    });
    await load();
  };

  const askInventory = async () => {
    if (!clinicId || !session || !question.trim()) return;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clinic_id: clinicId, question }),
    });
    const data = await response.json();
    setAnswer(data?.answer || 'Sem resposta no momento.');
  };

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="IA & Insights"
        subtitle="Análises automáticas e recomendações para compras inteligentes."
        actions={
          <button className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={generateInsight}>
            Gerar insight
          </button>
        }
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700">Pergunte ao estoque</h3>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="Ex: o que recomprar esta semana?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" onClick={askInventory}>
            Perguntar
          </button>
        </div>
        {answer ? <p className="mt-3 text-sm text-gray-700">{answer}</p> : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Insights recentes</h3>
        {loading ? (
          <div className="text-sm text-gray-500">Carregando insights...</div>
        ) : insights.length ? (
          insights.map((insight) => (
            <div key={insight.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{insight.title || 'Resumo semanal'}</p>
                  <p className="text-xs text-gray-500">
                    {insight.created_at ? new Date(insight.created_at).toLocaleString('pt-BR') : '—'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">{insight.summary}</p>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500">Nenhum insight gerado.</div>
        )}
      </div>
    </div>
  );
};

export default InventoryInsights;
