import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../src/auth/AuthProvider';
import { fetchCommercialData, buildRanking } from '../lib/commercial';
import { Loader2, ArrowUpDown, Calendar, Download } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

type SortKey = 'name' | 'faturamento' | 'atendimentos' | 'ticket' | 'recorrencia' | 'procedimentosCount';
type Period = 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

const rangeFromPeriod = (period: Period) => {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'quinzenal':
      start.setDate(start.getDate() - 15);
      break;
    case 'mensal':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'trimestral':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'semestral':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'anual':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      break;
  }
  return { from: formatDate(start), to: formatDate(end) };
};

const toCsvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const CommercialRanking: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('faturamento');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [rows, setRows] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [period, setPeriod] = useState<Period>('mensal');
  const [{ from, to }, setRange] = useState(() => rangeFromPeriod('mensal'));

  useEffect(() => {
    const load = async () => {
      if (!clinicId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchCommercialData({
        clinicId,
        from: from || undefined,
        to: to || undefined,
      });
      setRows(buildRanking(data));
      setLoading(false);
    };
    load();
  }, [clinicId, from, to]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      (row.categorias || []).forEach((category: string) => {
        if (category) set.add(category);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const procedureOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      (row.procedimentos || []).forEach((procedure: string) => {
        if (procedure) set.add(procedure);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCategory && !(row.categorias || []).includes(selectedCategory)) return false;
      if (selectedProcedure && !(row.procedimentos || []).includes(selectedProcedure)) return false;
      return true;
    });
  }, [rows, selectedCategory, selectedProcedure]);

  const ordered = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (a[sortKey] < b[sortKey]) return -1 * dir;
      if (a[sortKey] > b[sortKey]) return 1 * dir;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    if (next === 'personalizado') return;
    setRange(rangeFromPeriod(next));
  };

  const handleRangeChange = (nextFrom: string, nextTo: string) => {
    setPeriod('personalizado');
    setRange({ from: nextFrom, to: nextTo });
  };

  const exportCsv = () => {
    const header = ['Cliente', 'Faturamento', 'Atendimentos', 'Ticket médio', 'Recorrência', 'Qtd procedimentos'];
    const body = ordered.map((row) => [
      toCsvCell(row.name),
      toCsvCell((row.faturamento || 0).toFixed(2)),
      toCsvCell(row.atendimentos || 0),
      toCsvCell((row.ticket || 0).toFixed(2)),
      toCsvCell(row.recorrencia || 0),
      toCsvCell(row.procedimentosCount || 0),
    ].join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ranking-clientes-${from || 'inicio'}-${to || 'fim'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const htmlRows = ordered.map(r => `<tr>
      <td>${r.name}</td>
      <td>${formatCurrency(r.faturamento || 0)}</td>
      <td>${r.atendimentos}</td>
      <td>${formatCurrency(r.ticket || 0)}</td>
      <td>${r.recorrencia}</td>
      <td>${r.procedimentosCount}</td>
    </tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Ranking de Clientes</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Ranking de Clientes (${from || 'início'} a ${to || 'fim'})</h3>
      <table><thead><tr><th>Cliente</th><th>Faturamento</th><th>Atendimentos</th><th>Ticket médio</th><th>Recorrência</th><th>Qtd procedimentos</th></tr></thead>
      <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Comercial • Ranking dos Clientes</h1>
      <p className="text-gray-500">Ranking analítico por faturamento, ticket e recorrência.</p>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-sm text-gray-600">
          Clinic: {clinicId || '—'}
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <Calendar size={16} /> Período:
            <select value={period} onChange={e => handlePeriodChange(e.target.value as Period)} className="text-sm bg-transparent focus:outline-none">
              <option value="quinzenal">Últimos 15 dias</option>
              <option value="mensal">Últimos 30 dias</option>
              <option value="trimestral">Últimos 3 meses</option>
              <option value="semestral">Últimos 6 meses</option>
              <option value="anual">Últimos 12 meses</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-gray-600">
            <span>De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => handleRangeChange(e.target.value, to)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Até</span>
            <input
              type="date"
              value={to}
              onChange={(e) => handleRangeChange(from, e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Categorias:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="">Todas</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Procedimentos:</span>
            <select
              value={selectedProcedure}
              onChange={(e) => setSelectedProcedure(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="">Todos</option>
              {procedureOptions.map((procedure) => (
                <option key={procedure} value={procedure}>{procedure}</option>
              ))}
            </select>
          </label>
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} /> PDF
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} /> CSV
          </button>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin mr-2" size={20}/> Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                <tr>
                  {(
                    [
                      ['name', 'Cliente'],
                      ['faturamento', 'Faturamento'],
                      ['atendimentos', 'Atendimentos'],
                      ['ticket', 'Ticket médio'],
                      ['recorrencia', 'Recorrência (datas)'],
                      ['procedimentosCount', 'Qtd. procedimentos'],
                    ] as Array<[SortKey, string]>
                  ).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-600">
                        {label} <ArrowUpDown size={14}/>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ordered.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{row.name}</td>
                    <td className="px-4 py-2 text-gray-800">{formatCurrency(row.faturamento || 0)}</td>
                    <td className="px-4 py-2 text-gray-700">{row.atendimentos}</td>
                    <td className="px-4 py-2 text-gray-700">{formatCurrency(row.ticket || 0)}</td>
                    <td className="px-4 py-2 text-gray-700">{row.recorrencia}</td>
                    <td className="px-4 py-2 text-gray-700">{row.procedimentosCount}</td>
                  </tr>
                ))}
                {ordered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sem dados para a clínica.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommercialRanking;
