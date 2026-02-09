import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../src/auth/AuthProvider';
import { fetchCommercialData, buildRanking, buildRecurrence } from '../lib/commercial';
import { Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency, formatMonthYear } from '../lib/utils';

const CommercialDashboard: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [recorrencia, setRecorrencia] = useState<{ percentual: number }>({ percentual: 0 });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!clinicId) {
        setRevenues([]);
        setRanking([]);
        setRecorrencia({ percentual: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchCommercialData({
        clinicId,
        from: from || undefined,
        to: to || undefined,
      });
      setRevenues(data.revenues);
      setRanking(buildRanking(data));
      const rec = buildRecurrence(data, from || undefined, to || undefined);
      setRecorrencia({ percentual: rec.percentual });
      setLoading(false);
    };
    load();
  }, [clinicId, from, to]);

  const applyDateFilter = () => {
    setFrom(draftFrom);
    setTo(draftTo);
  };

  const clearDateFilter = () => {
    setDraftFrom('');
    setDraftTo('');
    setFrom('');
    setTo('');
  };

  const vendasSeries = useMemo(() => {
    const map: Record<string, number> = {};
    revenues.forEach(r => {
      const date = r.data_competencia || r.data_recebimento || '';
      if (!date) return;
      const ym = date.slice(0, 7);
      const val = Number(r.valor_liquido ?? r.valor ?? 0);
      map[ym] = (map[ym] || 0) + (isFinite(val) ? val : 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  }, [revenues]);

  const categoriasTop = useMemo(() => {
    const map: Record<string, number> = {};
    ranking.forEach(r => {
      r.categorias.forEach((c: string) => {
        if (!c) return;
        map[c] = (map[c] || 0) + 1;
      });
    });
    return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [ranking]);

  const categoriaColors = ['#2563eb', '#10b981', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#0ea5e9'];

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20}/> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Comercial • Dashboard</h1>
      <p className="text-gray-500">Visão consolidada de vendas, ticket e recorrência.</p>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
          Filtro de data
        </div>
        <div className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            <span>De</span>
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Até</span>
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <button
            type="button"
            onClick={applyDateFilter}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Aplicar
          </button>
          {(from || to || draftFrom || draftTo) && (
            <button
              type="button"
              onClick={clearDateFilter}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-lg p-4">
          <p className="text-xs uppercase text-gray-500">Faturamento total</p>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(revenues.reduce((s, r) => s + Number(r.valor_liquido ?? r.valor ?? 0), 0))}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-4">
          <p className="text-xs uppercase text-gray-500">Ticket médio global</p>
          <p className="text-2xl font-bold text-gray-800">
            {(() => {
              const atend = revenues.length || 1;
              const tot = revenues.reduce((s, r) => s + Number(r.valor_liquido ?? r.valor ?? 0), 0);
              return formatCurrency(tot / atend);
            })()}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-4">
          <p className="text-xs uppercase text-gray-500">% Recorrência</p>
          <p className="text-2xl font-bold text-gray-800">{recorrencia.percentual.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="font-semibold text-gray-800 mb-3">Evolução de vendas</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vendasSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={formatMonthYear} />
                <YAxis />
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v || 0))}
                  labelFormatter={(label) => formatMonthYear(String(label))}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="font-semibold text-gray-800 mb-3">Categorias mais vendidas</p>
          <div className="h-64">
            {categoriasTop.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriasTop} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {categoriasTop.map((entry, index) => (
                      <Cell key={entry.name} fill={categoriaColors[index % categoriaColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">Sem dados de categorias.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommercialDashboard;
