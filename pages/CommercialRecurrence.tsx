import React, { useEffect, useState } from 'react';
import { Loader2, Calendar, Download } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { fetchCommercialData, buildRecurrence } from '../lib/commercial';

type Period = 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';
const formatDate = (d: Date) => d.toISOString().slice(0, 10);

function rangeFromPeriod(period: Period) {
  const end = new Date();
  const start = new Date();
  if (period === 'quinzenal') start.setDate(start.getDate() - 15);
  else if (period === 'mensal') start.setMonth(start.getMonth() - 1);
  else if (period === 'trimestral') start.setMonth(start.getMonth() - 3);
  else if (period === 'semestral') start.setMonth(start.getMonth() - 6);
  else start.setFullYear(start.getFullYear() - 1);
  return { from: formatDate(start), to: formatDate(end) };
}

const CommercialRecurrence: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [period, setPeriod] = useState<Period>('semestral');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, recorrentes: 0, naoRecorrentes: 0, percentual: 0 });

  const [{ from, to }, setRange] = useState(() => rangeFromPeriod('semestral'));

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    if (next === 'personalizado') return;
    setRange(rangeFromPeriod(next));
  };

  const handleRangeChange = (nextFrom: string, nextTo: string) => {
    setPeriod('personalizado');
    setRange({ from: nextFrom, to: nextTo });
  };

  useEffect(() => {
    const load = async () => {
      if (!clinicId) {
        setRows([]);
        setStats({ total: 0, recorrentes: 0, naoRecorrentes: 0, percentual: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchCommercialData({ clinicId, from, to });
      const rec = buildRecurrence(data, from, to);
      setRows(rec.rows);
      setStats({ total: rec.total, recorrentes: rec.recorrentes, naoRecorrentes: rec.naoRecorrentes, percentual: rec.percentual });
      setLoading(false);
    };
    load();
  }, [clinicId, from, to]);

  const exportPdf = () => {
    const htmlRows = rows.map(r => `<tr>
      <td>${r.name}</td>
      <td>${r.atendimentos}</td>
      <td>${r.dates.join(', ')}</td>
      <td>${r.status}</td>
    </tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Recorrência</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Recorrência (${from} a ${to})</h3>
      <table><thead><tr><th>Cliente</th><th>Qtd atendimentos</th><th>Datas</th><th>Status</th></tr></thead>
      <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const exportCsv = () => {
    const header = ['Cliente', 'Qtd atendimentos', 'Datas', 'Status'];
    const body = rows.map((r) => [
      `"${String(r.name).replace(/"/g, '""')}"`,
      r.atendimentos,
      `"${r.dates.join(', ').replace(/"/g, '""')}"`,
      `"${String(r.status).replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recorrencia-${from || 'inicio'}-${to || 'fim'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Comercial • Recorrência</h1>
      <p className="text-gray-500">Análise de recorrência por período.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <Calendar size={16}/> Período:
          <select value={period} onChange={e => handlePeriodChange(e.target.value as Period)} className="text-sm bg-transparent focus:outline-none">
            <option value="quinzenal">Últimos 15 dias</option>
            <option value="mensal">Últimos 30 dias</option>
            <option value="trimestral">Últimos 3 meses</option>
            <option value="semestral">Últimos 6 meses</option>
            <option value="anual">Últimos 12 meses</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-gray-600 text-sm">
          <span>De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => handleRangeChange(e.target.value, to)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          />
        </label>
        <label className="flex items-center gap-2 text-gray-600 text-sm">
          <span>Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => handleRangeChange(from, e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          />
        </label>
        <button onClick={exportPdf} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50">
          <Download size={14}/> PDF
        </button>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50">
          <Download size={14}/> CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 p-4 rounded-lg">
          <p className="text-xs uppercase text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-lg">
          <p className="text-xs uppercase text-gray-500">Recorrentes</p>
          <p className="text-xl font-bold text-gray-800">{stats.recorrentes}</p>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-lg">
          <p className="text-xs uppercase text-gray-500">Não recorrentes</p>
          <p className="text-xl font-bold text-gray-800">{stats.naoRecorrentes}</p>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-lg">
          <p className="text-xs uppercase text-gray-500">% Recorrência</p>
          <p className="text-xl font-bold text-gray-800">{stats.percentual.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin mr-2" size={20}/> Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Qtd atendimentos</th>
                  <th className="px-4 py-3 text-left">Datas</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{r.name}</td>
                    <td className="px-4 py-2 text-gray-700">{r.atendimentos}</td>
                    <td className="px-4 py-2 text-gray-600">{r.dates.join(', ')}</td>
                    <td className={`px-4 py-2 text-xs font-semibold ${r.status === 'Recorrente' ? 'text-emerald-700' : 'text-gray-600'}`}>{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sem dados no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommercialRecurrence;
