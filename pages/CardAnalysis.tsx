import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, formatMonthYear } from '../lib/utils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Filter, Calendar, RefreshCw, BarChart2, TrendingUp as TrendingUpIcon, ArrowUpDown, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';

type Period = 'dia' | 'semana' | 'quinzenal' | 'mes' | 'ano';

interface RevenueRow {
  id: string;
  data_competencia: string;
  valor_bruto: number;
  valor_liquido: number;
  valor?: number | null;
  forma_pagamento: string;
  paciente?: string | null;
  data_recebimento?: string;
  parcelas?: number | null;
  recebimento_parcelas?: any;
  bandeira?: string | null;
  nsu?: string | null;
  observacoes?: string | null;
}

const addDays = (dateStr: string, days: number) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const addBusinessDays = (dateStr: string, days: number) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().split('T')[0];
};

const getRange = (period: Period) => {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today);
  switch (period) {
    case 'dia':
      break;
    case 'semana':
      start.setDate(today.getDate() - 7);
      break;
    case 'quinzenal':
      start.setDate(today.getDate() - 15);
      break;
    case 'mes':
      start.setMonth(today.getMonth() - 1);
      break;
    case 'ano':
      start.setFullYear(today.getFullYear() - 1);
      break;
  }
  return { start: start.toISOString().split('T')[0], end };
};

const parseManualParcelas = (value: any) => {
  if (!value) return [];
  try {
    const arr = Array.isArray(value) ? value : typeof value === 'string' ? JSON.parse(value) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (typeof item === 'string') return { vencimento: item };
        if (!item || typeof item !== 'object') return null;
        return { vencimento: item.vencimento || item.due_date || item.data || item.date || '' };
      })
      .filter(Boolean) as Array<{ vencimento: string }>;
  } catch {
    return [];
  }
};

const getManualDates = (rev: RevenueRow) =>
  parseManualParcelas(rev.recebimento_parcelas)
    .map((p) => p.vencimento)
    .filter(Boolean);

const settlementDate = (rev: RevenueRow, installmentNumber: number = 1) => {
  const comp = rev?.data_competencia;
  if (!comp) return '';
  const manualDates = getManualDates(rev);
  if (manualDates.length) {
    return manualDates[installmentNumber - 1] || manualDates[0];
  }
  const pay = (rev.forma_pagamento || '').toLowerCase();
  const base = rev.data_recebimento || comp;
  if (pay.includes('boleto') || pay.includes('cheque')) {
    return base;
  }
  if (pay.includes('débito') || pay.includes('debito')) {
    if (rev.data_recebimento) return base;
    return addBusinessDays(base, 1);
  }
  if (pay.includes('crédito') || pay.includes('credito') || pay.includes('convenio') || pay.includes('convênio')) {
    const offset = rev.data_recebimento ? 30 * (installmentNumber - 1) : 30 * installmentNumber;
    return addDays(base, offset);
  }
  return base;
};

const toDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const getBucketSortKey = (dateStr: string, period: Period) => {
  const d = toDate(dateStr);
  if (!d) return Number.POSITIVE_INFINITY;
  const key = new Date(d);
  key.setHours(0, 0, 0, 0);
  switch (period) {
    case 'semana': {
      const dayNum = (key.getDay() + 6) % 7;
      key.setDate(key.getDate() - dayNum);
      break;
    }
    case 'quinzenal':
      key.setDate(key.getDate() <= 15 ? 1 : 16);
      break;
    case 'mes':
      key.setDate(1);
      break;
    case 'ano':
      key.setMonth(0, 1);
      break;
    case 'dia':
    default:
      break;
  }
  return key.getTime();
};

const bucketKey = (dateStr: string, period: Period) => {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthLabel = months[d.getMonth()] ? `${months[d.getMonth()]}/${year}` : `${month}/${year}`;

  switch (period) {
    case 'dia':
      return `${year}-${month}-${day}`;
    case 'semana': {
      // iso week number rough calc
      const tmp = new Date(d.getTime());
      const dayNum = (d.getDay() + 6) % 7;
      tmp.setDate(d.getDate() - dayNum + 3);
      const firstThursday = new Date(tmp.getFullYear(), 0, 4);
      const weekNumber = 1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
      return `Semana ${weekNumber}/${year}`;
    }
    case 'quinzenal':
      return `${monthLabel} - ${d.getDate() <= 15 ? '1ª quinzena' : '2ª quinzena'}`;
    case 'mes':
      return monthLabel;
    case 'ano':
      return `${year}`;
    default:
      return dateStr;
  }
};

const formatBucketLabel = (label: string) => {
  if (!label) return '';
  if (label.includes('Semana') || label.includes('quinzena')) return label;
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return formatDate(label);
  if (/^\d{4}-\d{2}$/.test(label)) return formatMonthYear(label);
  return label;
};

const extractNsu = (observacoes?: string | null) => {
  if (!observacoes) return null;
  const match = observacoes.match(/NSU\s*:?\s*([^|]+)/i);
  if (!match) return null;
  return match[1].trim() || null;
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0,00%';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + '%';
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0,00';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const CardAnalysis: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const effectiveClinic = clinicId || null;
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [period, setPeriod] = useState<Period>('mes');
  const [dateStart, setDateStart] = useState(getRange('mes').start);
  const [dateEnd, setDateEnd] = useState(getRange('mes').end);
  const [tab, setTab] = useState<'vendas' | 'recebiveis'>('vendas');
  const [sortVendas, setSortVendas] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'data_competencia', direction: 'asc' });
  const [sortRecebiveis, setSortRecebiveis] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'data_recebimento', direction: 'asc' });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; paciente?: string | null; data?: string }>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null);
      if (!effectiveClinic) {
        setRevenues([]);
        return;
      }
      let selectCols = 'id, data_competencia, data_recebimento, recebimento_parcelas, valor_bruto, valor_liquido, valor, forma_pagamento, paciente, parcelas, bandeira, nsu, observacoes';
      let query = supabase.from('revenues').select(selectCols);
      if (effectiveClinic) query = query.eq('clinic_id', effectiveClinic);
      if (tab === 'vendas' && dateStart) query = query.gte('data_competencia', dateStart);
      if (dateEnd) query = query.lte('data_competencia', dateEnd);
      let { data, error } = await query;
      // Fallback se algumas colunas não existirem
      if (error) {
        const msg = `${error.message}`.toLowerCase();
        if (msg.includes('nsu') || msg.includes('recebimento_parcelas')) {
          selectCols = 'id, data_competencia, data_recebimento, valor_bruto, valor_liquido, valor, forma_pagamento, paciente, parcelas, bandeira, observacoes';
          query = supabase.from('revenues').select(selectCols);
          if (effectiveClinic) query = query.eq('clinic_id', effectiveClinic);
          if (tab === 'vendas' && dateStart) query = query.gte('data_competencia', dateStart);
          if (dateEnd) query = query.lte('data_competencia', dateEnd);
          ({ data, error } = await query);
        }
      }
      if (error) throw error;
      const normalized = (data || []).map((item: any) => ({
        ...item,
        nsu: item.nsu || extractNsu(item.observacoes),
      }));
      setRevenues(normalized as any);
    } catch (err: any) {
      console.error(err);
      setFetchError(err?.message || 'Erro ao carregar dados');
      setRevenues([]);
    }
  }, [dateStart, dateEnd, tab, effectiveClinic]);

  useEffect(() => {
    const { start, end } = getRange(period);
    setDateStart(start);
    setDateEnd(end);
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const filter = effectiveClinic ? `clinic_id=eq.${effectiveClinic}` : undefined;
    const channel = supabase.channel(`card-analysis-updates-${effectiveClinic ?? 'all'}`);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'revenues', ...(filter ? { filter } : {}) },
      () => fetchData()
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveClinic, fetchData]);

  useEffect(() => {
    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData]);

  useEffect(() => {
    const interval = window.setInterval(() => fetchData(), 30000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const handleDeleteRevenue = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('revenues').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      alert('Erro ao excluir venda: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const expandParcelas = (rows: RevenueRow[]) => {
    const list: any[] = [];
    rows.forEach(r => {
      if (!r.data_competencia) return;
      const manualDates = getManualDates(r);
      const totalParcelas = Math.max(1, manualDates.length || Number(r.parcelas || 1));
      const baseBruto = Number(r.valor_bruto ?? r.valor ?? r.valor_liquido ?? 0);
      const baseLiquido = Number(r.valor_liquido ?? r.valor ?? r.valor_bruto ?? 0);
      for (let i = 1; i <= totalParcelas; i++) {
        const parcelaValor = baseBruto / totalParcelas;
        const parcelaLiquido = baseLiquido / totalParcelas;
        const dataVenda = r.data_competencia;
        const dataReceb = manualDates[i - 1] || settlementDate(r, i) || dataVenda;
        list.push({
          ...r,
          parcelaNumero: i,
          parcelaTotal: totalParcelas,
          valorParcela: parcelaValor,
          valorParcelaLiquido: parcelaLiquido,
          data_recebimento: dataReceb,
          data_venda: dataVenda,
        });
      }
    });
    return list;
  };

  const sortRows = (rows: any[], sort: { column: string; direction: 'asc' | 'desc' }) => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sort.column] ?? '';
      const vb = b[sort.column] ?? '';
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  };

  const vendasFiltradas = useMemo(() => {
    return revenues.filter(r => r.data_competencia >= dateStart && r.data_competencia <= dateEnd);
  }, [revenues, dateStart, dateEnd]);

  const parcelasExpandidas = useMemo(() => expandParcelas(revenues), [revenues]);

  const vendasBucket = useMemo(() => {
    const map = new Map<string, { bucket: string; bruto: number; liquido: number; sortKey: number }>();
    vendasFiltradas.forEach(r => {
      const bucket = bucketKey(r.data_competencia, period);
      const sortKey = getBucketSortKey(r.data_competencia, period);
      const item = map.get(bucket) || { bucket, bruto: 0, liquido: 0, sortKey };
      item.bruto += Number(r.valor_bruto ?? r.valor ?? 0);
      item.liquido += Number(r.valor_liquido ?? r.valor ?? 0);
      item.sortKey = Math.min(item.sortKey, sortKey);
      map.set(bucket, item);
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [vendasFiltradas, period]);

  const recebiveisFuturos = useMemo(() => {
    const map = new Map<string, { bucket: string; liquido: number; sortKey: number }>();
    const startReceb = dateStart > todayStr ? dateStart : todayStr;
    const parcelas = parcelasExpandidas.filter(p => p.data_recebimento && p.data_recebimento >= startReceb && p.data_recebimento <= dateEnd);
    parcelas.forEach(r => {
      const recebedata = r.data_recebimento as string;
      const bucket = bucketKey(recebedata, period);
      const sortKey = getBucketSortKey(recebedata, period);
      const item = map.get(bucket) || { bucket, liquido: 0, sortKey };
      item.liquido += Number(r.valorParcelaLiquido || r.valor_liquido || 0);
      item.sortKey = Math.min(item.sortKey, sortKey);
      map.set(bucket, item);
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [parcelasExpandidas, dateStart, dateEnd, todayStr, period]);

  const vendasDetalhadas = useMemo(() => {
    const filtered = revenues.filter(r => r.data_competencia >= dateStart && r.data_competencia <= dateEnd);
    return sortRows(expandParcelas(filtered), sortVendas);
  }, [revenues, dateStart, dateEnd, sortVendas]);

  const recebiveisDetalhados = useMemo(() => {
    const startReceb = dateStart > todayStr ? dateStart : todayStr;
    const filtered = parcelasExpandidas.filter(r => r.data_recebimento && (r.data_recebimento as string) >= startReceb && (r.data_recebimento as string) <= dateEnd);
    return sortRows(filtered, sortRecebiveis);
  }, [parcelasExpandidas, dateStart, dateEnd, sortRecebiveis, todayStr]);

  const handleSort = (column: string, table: 'vendas' | 'recebiveis') => {
    if (table === 'vendas') {
      setSortVendas(prev => ({
        column,
        direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
    } else {
      setSortRecebiveis(prev => ({
        column,
        direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
    }
  };

  const exportCSV = (rows: any[], filename: string) => {
    const headers = ['Paciente', 'Data venda', 'Data recebimento', 'Parcela', 'Valor venda', 'Valor parcela', 'Parcela líquido', 'Forma pgto', 'NSU', 'Bandeira'];
    const escapeCsv = (value: any) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      const escaped = str.replace(/"/g, '""');
      return /[;\n\r"]/.test(escaped) ? `"${escaped}"` : escaped;
    };
    const lines = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(r => [
        escapeCsv(r.paciente || '-'),
        escapeCsv(formatDate(r.data_venda || r.data_competencia)),
        escapeCsv(formatDate(r.data_recebimento || settlementDate(r))),
        escapeCsv(`${r.parcelaNumero || 1}/${r.parcelaTotal || 1}`),
        escapeCsv(formatNumber(Number(r.valor_bruto || r.valor || r.valor_liquido || 0))),
        escapeCsv(formatNumber(Number(r.valorParcela || 0))),
        escapeCsv(formatNumber(Number(r.valorParcelaLiquido || 0))),
        escapeCsv(r.forma_pagamento || '-'),
        escapeCsv(r.nsu || '-'),
        escapeCsv(r.bandeira || '-'),
      ].join(';'))
    ];
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = (rows: any[], title: string) => {
    const htmlRows = rows.map(r => `
      <tr>
        <td>${r.paciente || '-'}</td>
        <td>${formatDate(r.data_venda || r.data_competencia)}</td>
        <td>${formatDate(r.data_recebimento || settlementDate(r))}</td>
        <td>${r.parcelaNumero || 1}/${r.parcelaTotal || 1}</td>
        <td>${formatCurrency(Number(r.valor_bruto || r.valor || r.valor_liquido || 0))}</td>
        <td>${formatCurrency(Number(r.valorParcela || 0))}</td>
        <td>${formatCurrency(Number(r.valorParcelaLiquido || 0))}</td>
        <td>${r.forma_pagamento || '-'}</td>
        <td>${r.nsu || '-'}</td>
        <td>${r.bandeira || '-'}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <table>
            <thead>
              <tr>
                <th>Paciente</th><th>Data venda</th><th>Data receb.</th><th>Parcela</th><th>Valor venda</th><th>Valor parcela</th><th>Parcela líquido</th><th>Forma pgto</th><th>NSU</th><th>Bandeira</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const totais = useMemo(() => {
    const vendidoBruto = vendasFiltradas.reduce((s, r) => s + Number(r.valor_bruto ?? r.valor ?? 0), 0);
    const vendidoLiquido = vendasFiltradas.reduce((s, r) => s + Number(r.valor_liquido ?? r.valor ?? 0), 0);
    const startReceb = dateStart > todayStr ? dateStart : todayStr;
    const receberPeriodo = parcelasExpandidas.reduce((s, r) => {
      const liqDate = r.data_recebimento as string;
      if (liqDate && liqDate >= startReceb && liqDate <= dateEnd) {
        return s + Number(r.valorParcelaLiquido || r.valor_liquido || 0);
      }
      return s;
    }, 0);
    const taxaPercentual = vendidoBruto > 0 ? (1 - (vendidoLiquido / vendidoBruto)) * 100 : 0;
    return { vendidoBruto, vendidoLiquido, receberPeriodo, taxaPercentual };
  }, [vendasFiltradas, parcelasExpandidas, dateStart, dateEnd, todayStr]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Análise de Cartão</h1>
          <p className="text-gray-500">Compare vendas e recebíveis considerando taxas e prazos de cartão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['dia','semana','quinzenal','mes','ano'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-sm border ${period === p ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="px-3 py-2 border border-gray-200 rounded-lg text-gray-700 flex items-center gap-2"
            title="Atualiza os dados do período"
          >
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={16}/></span>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <span className="text-gray-400">até</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={16}/></span>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-gray-500">Vendido (bruto)</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(totais.vendidoBruto)}</p>
            </div>
            <div>
              <p className="text-gray-500">Vendido (líquido c/ taxa)</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(totais.vendidoLiquido)}</p>
            </div>
            <div>
              <p className="text-gray-500">A receber no período</p>
              <p className="text-lg font-semibold text-emerald-700">{formatCurrency(totais.receberPeriodo)}</p>
            </div>
            <div>
              <p className="text-gray-500">Taxa média cobrada</p>
              <p className="text-lg font-semibold text-gray-800">{formatPercent(totais.taxaPercentual)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        {fetchError && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            Erro ao carregar dados: {fetchError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${tab === 'vendas' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            onClick={() => setTab('vendas')}
          >
            <BarChart2 size={16}/> Vendas
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${tab === 'recebiveis' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            onClick={() => setTab('recebiveis')}
          >
            <TrendingUpIcon size={16}/> Recebíveis
          </button>
        </div>

        {tab === 'vendas' && (
          <>
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold">
              <Filter size={16}/> Vendas por data (bruto x líquido)
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vendasBucket}>
                  <defs>
                    <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradLiquido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tickFormatter={formatBucketLabel} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatBucketLabel} />
                  <Legend />
                  <Area type="monotone" dataKey="bruto" stroke="#64748b" fill="url(#gradBruto)" name="Bruto" />
                  <Area type="monotone" dataKey="liquido" stroke="#0ea5e9" fill="url(#gradLiquido)" name="Líquido (c/ taxa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-gray-600 flex items-center gap-2 font-semibold">
                Detalhe de vendas
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => exportCSV(vendasDetalhadas, 'onefinc-vendas')}
                  className="flex items-center gap-1 px-3 py-1 text-xs border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14}/> CSV
                </button>
                <button
                  onClick={() => exportPDF(vendasDetalhadas, 'Vendas')}
                  className="flex items-center gap-1 px-3 py-1 text-xs border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14}/> PDF
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-[420px] overflow-auto">
              <table className="min-w-[1100px] w-full text-sm border-t border-gray-100 table-fixed whitespace-nowrap">
                <thead>
                  <tr className="text-left text-gray-500">
                    {[
                      { key: 'paciente', label: 'Paciente' },
                      { key: 'data_venda', label: 'Data venda' },
                      { key: 'data_recebimento', label: 'Data receb.' },
                      { key: 'parcelaNumero', label: 'Parcela' },
                      { key: 'valor_bruto', label: 'Valor venda' },
                      { key: 'valorParcela', label: 'Valor parcela' },
                      { key: 'valorParcelaLiquido', label: 'Parcela líquido' },
                      { key: 'forma_pagamento', label: 'Forma pgto' },
                      { key: 'nsu', label: 'NSU' },
                      { key: 'bandeira', label: 'Bandeira' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="py-2 pr-3 font-medium cursor-pointer select-none"
                        onClick={() => handleSort(col.key, 'vendas')}
                      >
                        <span className="inline-flex items-center gap-1">{col.label} <ArrowUpDown size={12} className="text-gray-400" /></span>
                      </th>
                    ))}
                    <th className="py-2 pr-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasDetalhadas.map(row => (
                    <tr key={`${row.id}-${row.parcelaNumero}`} className="border-t border-gray-100">
                      <td className="py-2 pr-3 text-gray-800 truncate max-w-[180px]" title={row.paciente || '-'}>
                        {row.paciente || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 w-32">{formatDate(row.data_venda || row.data_competencia)}</td>
                      <td className="py-2 pr-3 text-gray-600 w-32">{formatDate(row.data_recebimento as string)}</td>
                      <td className="py-2 pr-3 text-gray-600 w-28">{`${row.parcelaNumero || 1} de ${row.parcelaTotal || 1}`}</td>
                      <td className="py-2 pr-3 text-gray-900 font-semibold w-32">{formatCurrency(Number(row.valor_bruto || row.valor || 0))}</td>
                      <td className="py-2 pr-3 text-gray-900 w-32">{formatCurrency(Number(row.valorParcela || 0))}</td>
                      <td className="py-2 pr-3 text-gray-900 w-40">{formatCurrency(Number(row.valorParcelaLiquido || 0))}</td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[170px]" title={row.forma_pagamento || '-'}>
                        {row.forma_pagamento || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]" title={row.nsu || '-'}>
                        {row.nsu || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]" title={row.bandeira || '-'}>
                        {row.bandeira || '-'}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: row.id, paciente: row.paciente, data: row.data_venda || row.data_competencia })}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir venda"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vendasDetalhadas.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-3 text-center text-gray-400">Nenhum registro no período selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'recebiveis' && (
          <>
            <div className="flex items-center gap-2 mb-1 text-gray-700 font-semibold">
              <Filter size={16}/> Recebíveis futuros (líquido)
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Mostrando apenas recebíveis a partir de hoje ({formatDate(todayStr)}) para facilitar a previsão de entradas futuras.
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recebiveisFuturos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tickFormatter={formatBucketLabel} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatBucketLabel} />
                  <Legend />
                  <Bar dataKey="liquido" fill="#22c55e" name="Líquido a receber" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-gray-600 flex items-center gap-2 font-semibold">
                Detalhe de recebíveis
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => exportCSV(recebiveisDetalhados, 'onefinc-recebiveis')}
                  className="flex items-center gap-1 px-3 py-1 text-xs border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14}/> CSV
                </button>
                <button
                  onClick={() => exportPDF(recebiveisDetalhados, 'Recebiveis')}
                  className="flex items-center gap-1 px-3 py-1 text-xs border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14}/> PDF
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-[420px] overflow-auto">
              <table className="min-w-[1100px] w-full text-sm border-t border-gray-100 table-fixed whitespace-nowrap">
                <thead>
                  <tr className="text-left text-gray-500">
                    {[
                      { key: 'paciente', label: 'Paciente' },
                      { key: 'data_venda', label: 'Data venda' },
                      { key: 'data_recebimento', label: 'Data receb.' },
                      { key: 'parcelaNumero', label: 'Parcela' },
                      { key: 'valor_bruto', label: 'Valor venda' },
                      { key: 'valorParcela', label: 'Valor parcela' },
                      { key: 'valorParcelaLiquido', label: 'Parcela líquido' },
                      { key: 'forma_pagamento', label: 'Forma pgto' },
                      { key: 'nsu', label: 'NSU' },
                      { key: 'bandeira', label: 'Bandeira' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="py-2 pr-3 font-medium cursor-pointer select-none"
                        onClick={() => handleSort(col.key, 'recebiveis')}
                      >
                        <span className="inline-flex items-center gap-1">{col.label} <ArrowUpDown size={12} className="text-gray-400" /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recebiveisDetalhados.map(row => (
                    <tr key={`${row.id}-${row.parcelaNumero}`} className="border-t border-gray-100">
                      <td className="py-2 pr-3 text-gray-800 truncate max-w-[180px]" title={row.paciente || '-'}>
                        {row.paciente || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 w-32">{formatDate(row.data_venda || row.data_competencia)}</td>
                      <td className="py-2 pr-3 text-gray-600 w-32">{formatDate(row.data_recebimento as string)}</td>
                      <td className="py-2 pr-3 text-gray-600 w-28">{`${row.parcelaNumero || 1} de ${row.parcelaTotal || 1}`}</td>
                      <td className="py-2 pr-3 text-gray-900 font-semibold w-32">{formatCurrency(Number(row.valor_bruto || row.valor || 0))}</td>
                      <td className="py-2 pr-3 text-gray-900 w-32">{formatCurrency(Number(row.valorParcela || 0))}</td>
                      <td className="py-2 pr-3 text-gray-900 w-40">{formatCurrency(Number(row.valorParcelaLiquido || 0))}</td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[170px]" title={row.forma_pagamento || '-'}>
                        {row.forma_pagamento || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]" title={row.nsu || '-'}>
                        {row.nsu || '-'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]" title={row.bandeira || '-'}>
                        {row.bandeira || '-'}
                      </td>
                    </tr>
                  ))}
                  {recebiveisDetalhados.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-3 text-center text-gray-400">Nenhum recebível no período selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/20 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-red-200">
            <div className="flex items-start gap-3 p-5 border-b border-red-100">
              <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Ação irreversível</h3>
                <p className="text-sm text-gray-600">
                  Você está prestes a excluir esta venda e todas as parcelas associadas.
                  Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Paciente:</span> {deleteTarget.paciente || '-'}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Data da venda:</span> {deleteTarget.data ? formatDate(deleteTarget.data) : '-'}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 bg-red-50/60">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-white"
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteRevenue}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardAnalysis;
