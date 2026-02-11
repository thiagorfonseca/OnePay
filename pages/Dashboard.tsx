import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Loader2, Calendar, AlertTriangle, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, formatMonthYear } from '../lib/utils';
import { supabase } from '../lib/supabase';
import {
  gerarParcelasDeCaixa,
  gerarFluxoDiario,
  gerarFluxoMensal,
  aplicarSaldoAcumulado,
  Lancamento,
  ParcelaCaixa,
} from '../lib/cashflow';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';
import { useSearchParams } from 'react-router-dom';

const getIncomeBilledValue = (income: any) =>
  Number(income?.valor_bruto ?? income?.valor ?? income?.valor_liquido ?? 0) || 0;

const Dashboard: React.FC = () => {
  const { effectiveClinicId, isAdmin, isSystemAdmin, selectedClinicId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cashParcels, setCashParcels] = useState<ParcelaCaixa[]>([]);
  const [incomesRaw, setIncomesRaw] = useState<any[]>([]);
  const [expensesRaw, setExpensesRaw] = useState<any[]>([]);
  const [dateStart, setDateStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dateEnd, setDateEnd] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const formatDateInput = (date: Date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const parseDateInput = (value: string) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const parseBalanceValue = (value: any) => {
    if (typeof value === 'string') {
      const num = Number(value.replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    const num = Number(value || 0);
    return isNaN(num) ? 0 : num;
  };

  const recalcAccountBalances = async (accountList: any[], incomes: any[], expenses: any[]) => {
    if (!accountList.length) return accountList;

    const toDate = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
      const alt = new Date(`${value}T00:00:00`);
      return Number.isNaN(alt.getTime()) ? null : alt;
    };

    const addDaysToDate = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    const addBusinessDaysToDate = (date: Date, days: number) => {
      const d = new Date(date);
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) added += 1;
      }
      return d;
    };

    const addMonthsToDate = (date: Date, months: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return d;
    };

    const normalizeForma = (value?: string | null) => {
      const raw = (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      if (raw.includes('CREDITO')) return 'CREDITO';
      if (raw.includes('DEBITO')) return 'DEBITO';
      if (raw.includes('PIX')) return 'PIX';
      if (raw.includes('BOLETO')) return 'BOLETO';
      if (raw.includes('CHEQUE')) return 'CHEQUE';
      if (raw.includes('TRANSFER') || raw.includes('TED') || raw.includes('DOC')) return 'TRANSFERENCIA';
      if (raw.includes('CONVENIO')) return 'CONVENIO';
      if (raw.includes('DINHEIRO') || raw.includes('CASH')) return 'DINHEIRO';
      return 'OUTRO';
    };

    const splitParcelas = (total: number, parcelas: number) => {
      const base = Math.floor((total / parcelas) * 100) / 100;
      const arr = Array(parcelas).fill(base);
      const somaBase = base * parcelas;
      const diff = Math.round((total - somaBase) * 100) / 100;
      arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
      return arr;
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
            return {
              vencimento: item.vencimento || item.due_date || item.data || item.date || '',
            };
          })
          .filter(Boolean) as Array<{ vencimento: string }>;
      } catch {
        return [];
      }
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getReceitaRecebida = (i: any) => {
      const total = Number(i.valor_liquido ?? i.valor_bruto ?? i.valor ?? 0);
      if (!Number.isFinite(total) || total === 0) return 0;
      const manualDates = parseManualParcelas(i.recebimento_parcelas)
        .map(p => toDate(p.vencimento))
        .filter(Boolean) as Date[];
      const parcelas = Math.max(1, manualDates.length || parseInt(i.parcelas || '1', 10) || 1);
      const forma = normalizeForma(i.forma_pagamento);
      const baseReceb = toDate(i.data_recebimento);
      const comp = toDate(i.data_competencia);
      let base: Date | null = null;
      if (forma === 'BOLETO' || forma === 'CHEQUE') {
        base = baseReceb || comp;
      } else if (forma === 'CREDITO' || forma === 'CONVENIO') {
        base = baseReceb || (comp ? addDaysToDate(comp, 30) : null);
      } else if (forma === 'DEBITO') {
        base = baseReceb || (comp ? addBusinessDaysToDate(comp, 1) : null);
      } else {
        base = baseReceb || comp;
      }
      if (!base && manualDates.length === 0) return 0;

      const intervalDays = (forma === 'CREDITO' || forma === 'CONVENIO') ? 30 : 0;
      const valores = splitParcelas(total, parcelas);
      let recebido = 0;
      for (let idx = 0; idx < parcelas; idx += 1) {
        let dataPrevista = manualDates[idx] || base;
        if (!dataPrevista) continue;
        if (!manualDates[idx]) {
          if (intervalDays && idx > 0) dataPrevista = addDaysToDate(base as Date, intervalDays * idx);
          else if (!intervalDays && parcelas > 1 && idx > 0) dataPrevista = addMonthsToDate(base as Date, idx);
        }
        if (dataPrevista <= today) recebido += valores[idx] || 0;
      }
      return recebido;
    };

    const receitaPorConta = new Map<string, number>();
    incomes.forEach((i: any) => {
      if (!i.bank_account_id) return;
      const value = getReceitaRecebida(i);
      if (!Number.isFinite(value) || value === 0) return;
      receitaPorConta.set(i.bank_account_id, (receitaPorConta.get(i.bank_account_id) || 0) + value);
    });

    const despesaPorConta = new Map<string, number>();
    expenses.forEach((e: any) => {
      if (!e.bank_account_id) return;
      if (e.status !== 'paid') return;
      const value = Number(e.valor ?? 0);
      if (!Number.isFinite(value)) return;
      despesaPorConta.set(e.bank_account_id, (despesaPorConta.get(e.bank_account_id) || 0) + value);
    });

    const updates: Array<{ id: string; current_balance: number }> = [];
    const recalculated = accountList.map((acc) => {
      const initial = parseBalanceValue(acc.initial_balance ?? 0);
      const receitas = receitaPorConta.get(acc.id) || 0;
      const despesas = despesaPorConta.get(acc.id) || 0;
      const nextBalance = initial + receitas - despesas;
      const current = parseBalanceValue(acc.current_balance ?? acc.initial_balance ?? 0);
      if (Math.abs(current - nextBalance) > 0.009) {
        updates.push({ id: acc.id, current_balance: nextBalance });
      }
      return { ...acc, current_balance: nextBalance };
    });

    if (updates.length) {
      await Promise.all(
        updates.map((u) =>
          supabase.from('bank_accounts').update({ current_balance: u.current_balance }).eq('id', u.id)
        )
      );
    }

    return recalculated;
  };
  const [tab, setTab] = useState<'dre' | 'caixa'>(() => {
    const t = searchParams.get('tab');
    return t === 'caixa' ? 'caixa' : 'dre';
  });
  const [cashChartMode, setCashChartMode] = useState<'linha' | 'coluna'>('linha');
  const [isCashChartExpanded, setIsCashChartExpanded] = useState(false);
  const dreChartRef = useRef<HTMLDivElement | null>(null);

  const fetchDashboardData = useCallback(async () => {
    // Para admin, permitir quando houver seleção (ou todas = null); para user, exige clinic
    if (!effectiveClinicId && !isAdmin) return;
    setLoading(true);
    try {
      const clinicFilter = effectiveClinicId;
      // 1. Buscar todas as Receitas
      let revQuery = supabase
        .from('revenues')
        .select('id, description, valor_liquido, valor_bruto, data_competencia, data_recebimento, forma_pagamento, parcelas, status, recebimento_parcelas, categories(name), bank_account_id');
      if (clinicFilter) revQuery = revQuery.eq('clinic_id', clinicFilter);
      const { data: incomes } = await revQuery;

      // 2. Buscar todas as Despesas
      let expQuery = supabase
        .from('expenses')
        .select('id, description, valor, data_competencia, data_pagamento, data_vencimento, forma_pagamento, parcelas, status, categories(name), bank_account_id');
      if (clinicFilter) expQuery = expQuery.eq('clinic_id', clinicFilter);
      const { data: expenses } = await expQuery;

      // 3. Buscar Contas Bancárias (para saldo atual)
      let accQuery = supabase.from('bank_accounts').select('id, clinic_id, current_balance, initial_balance');
      if (clinicFilter) accQuery = accQuery.eq('clinic_id', clinicFilter);
      const { data: bankAccs } = await accQuery;
      const recalculated = await recalcAccountBalances(bankAccs || [], incomes || [], expenses || []);
      setAccounts(recalculated || []);
      setIncomesRaw(incomes || []);
      setExpensesRaw(expenses || []);

      // -------- Fluxo de Caixa Inteligente --------
      const parseDate = (d?: string | null) => {
        if (!d) return undefined;
        const parsed = new Date(d);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
      };
      const mapForma = (f?: string | null) => {
        const t = (f || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        if (t.includes('CREDITO')) return 'CREDITO';
        if (t.includes('DEBITO')) return 'DEBITO';
        if (t.includes('PIX')) return 'PIX';
        if (t.includes('BOLETO')) return 'BOLETO';
        if (t.includes('CHEQUE')) return 'CHEQUE';
        if (t.includes('TRANSFER') || t.includes('TED') || t.includes('DOC')) return 'TRANSFERENCIA';
        if (t.includes('CONVENIO')) return 'CONVENIO';
        if (t.includes('DINHEIRO') || t.includes('CASH')) return 'DINHEIRO';
        return 'OUTRO';
      };

      const parseManualDates = (value: any) => {
        if (!value) return [];
        try {
          const arr = Array.isArray(value) ? value : typeof value === 'string' ? JSON.parse(value) : [];
          if (!Array.isArray(arr)) return [];
          return arr
            .map((item) => {
              if (typeof item === 'string') return parseDate(item);
              if (!item || typeof item !== 'object') return null;
              return parseDate(item.vencimento || item.due_date || item.data || item.date || '');
            })
            .filter(Boolean) as Date[];
        } catch {
          return [];
        }
      };

      const lancamentos: Lancamento[] = [];

      (incomes || []).forEach((i: any) => {
        const dataEmissao = parseDate(i.data_competencia);
        if (!dataEmissao) return;
        const manualDates = parseManualDates(i.recebimento_parcelas);
        lancamentos.push({
          id: i.id,
          tipo: 'RECEITA',
          descricao: i.description || 'Receita',
          dataEmissao,
          dataVencimento: parseDate(i.data_recebimento),
          formaPagamento: mapForma(i.forma_pagamento),
          valorTotal: i.valor_liquido || i.valor_bruto || 0,
          numeroParcelas: Math.max(1, manualDates.length || parseInt(i.parcelas || 1, 10)),
          datasParcelas: manualDates.length ? manualDates : undefined,
          status: i.status === 'paid' ? 'REALIZADO' : 'PREVISTO',
          dataBaixa: parseDate(i.data_recebimento),
        });
      });

      (expenses || []).forEach((e: any) => {
        const dataEmissao = parseDate(e.data_competencia);
        if (!dataEmissao) return;
        lancamentos.push({
          id: e.id,
          tipo: 'DESPESA',
          descricao: e.description || 'Despesa',
          dataEmissao,
          dataVencimento: parseDate(e.data_vencimento || e.data_competencia),
          formaPagamento: mapForma(e.forma_pagamento),
          valorTotal: e.valor || 0,
          numeroParcelas: parseInt(e.parcelas || 1, 10),
          status: e.status === 'paid' ? 'REALIZADO' : 'PREVISTO',
          dataBaixa: parseDate(e.data_pagamento),
        });
      });

      const parcelas = gerarParcelasDeCaixa(lancamentos);
      setCashParcels(parcelas);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveClinicId, isAdmin, selectedClinicId]);

  // Buscar dados reais do Supabase
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!effectiveClinicId && !isAdmin) return;
    const filter = effectiveClinicId ? `clinic_id=eq.${effectiveClinicId}` : undefined;
    const channel = supabase.channel(`dashboard-updates-${effectiveClinicId ?? 'all'}`);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'revenues', ...(filter ? { filter } : {}) },
      () => fetchDashboardData()
    );
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', ...(filter ? { filter } : {}) },
      () => fetchDashboardData()
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveClinicId, isAdmin, fetchDashboardData]);

  // Atualização apenas via realtime ou ações do usuário

  const withinRange = (d?: string | Date | null) => {
    if (!d) return false;
    const dt = d instanceof Date ? d : new Date(d);
    return dt >= dateStart && dt <= dateEnd;
  };

  const escapeXml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const buildSpreadsheetXml = (sheetName: string, rows: Array<Array<{ type: 'String' | 'Number'; value: string | number }>>) => {
    const xmlRows = rows
      .map((row) => {
        const cells = row
          .map((cell) => {
            const value = cell.type === 'Number' ? cell.value : escapeXml(String(cell.value));
            return `<Cell><Data ss:Type="${cell.type}">${value}</Data></Cell>`;
          })
          .join('');
        return `<Row>${cells}</Row>`;
      })
      .join('');
    return `<?xml version="1.0"?>\n` +
      `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
      `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${xmlRows}</Table></Worksheet>` +
      `</Workbook>`;
  };

  const getChartPngData = (container: HTMLDivElement | null) =>
    new Promise<string | null>((resolve) => {
      if (!container) {
        resolve(null);
        return;
      }
      const svg = container.querySelector('svg');
      if (!svg) {
        resolve(null);
        return;
      }
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width)) || Number(svg.getAttribute('width')) || 800;
      const height = Math.max(1, Math.floor(rect.height)) || Number(svg.getAttribute('height')) || 400;
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      if (!clone.getAttribute('viewBox')) {
        clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      const originalNodes = svg.querySelectorAll('*');
      const clonedNodes = clone.querySelectorAll('*');
      originalNodes.forEach((node, index) => {
        const cloneNode = clonedNodes[index] as Element | undefined;
        if (!cloneNode) return;
        if (!(node instanceof Element)) return;
        const computed = window.getComputedStyle(node);
        const stylePieces = [
          `fill:${computed.getPropertyValue('fill')};`,
          `stroke:${computed.getPropertyValue('stroke')};`,
          `stroke-width:${computed.getPropertyValue('stroke-width')};`,
          `font-size:${computed.getPropertyValue('font-size')};`,
          `font-family:${computed.getPropertyValue('font-family')};`,
          `font-weight:${computed.getPropertyValue('font-weight')};`,
          `opacity:${computed.getPropertyValue('opacity')};`,
        ];
        const existing = cloneNode.getAttribute('style') || '';
        cloneNode.setAttribute('style', `${existing}${stylePieces.join('')}`);
      });

      const serializer = new XMLSerializer();
      const svgText = serializer.serializeToString(clone);
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });

  const exportChartPng = async (container: HTMLDivElement | null, filename: string) => {
    const dataUrl = await getChartPngData(container);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    link.click();
  };

  const exportChartPdf = async (container: HTMLDivElement | null, title: string) => {
    const dataUrl = await getChartPngData(container);
    if (!dataUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>body{font-family:Arial;padding:16px;text-align:center;}img{max-width:100%;}</style>
        </head>
        <body>
          <h3>${title}</h3>
          <img id="chart-image" src="${dataUrl}" alt="${title}" />
          <script>
            const img = document.getElementById('chart-image');
            img.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const exportFluxoDiarioExcel = () => {
    const rows = [
      [
        { type: 'String', value: 'Data' },
        { type: 'String', value: 'Receitas' },
        { type: 'String', value: 'Despesas' },
        { type: 'String', value: 'Saldo do Dia' },
        { type: 'String', value: 'Saldo Acumulado' },
        { type: 'String', value: 'Saldo Banco' },
      ],
      ...fluxoDiarioTabela.map((d: any) => [
        { type: 'String', value: d.data.toLocaleDateString('pt-BR') },
        { type: 'Number', value: Number(d.totalReceitasPrevistas || 0) },
        { type: 'Number', value: Number(d.totalDespesasPrevistas || 0) },
        { type: 'Number', value: Number(d.saldoPrevistoDia || 0) },
        { type: 'Number', value: Number(d.saldoAcumulado || 0) },
        { type: 'Number', value: Number(d.saldoBanco || 0) },
      ]),
    ];
    const xml = buildSpreadsheetXml('Fluxo Previsto (período)', rows as Array<Array<{ type: 'String' | 'Number'; value: string | number }>>);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo-previsto-periodo-${formatDateInput(dateStart)}-${formatDateInput(dateEnd)}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFluxoDiarioPdf = () => {
    const htmlRows = fluxoDiarioTabela.map((d: any) => `
      <tr>
        <td>${d.data.toLocaleDateString('pt-BR')}</td>
        <td>${formatCurrency(d.totalReceitasPrevistas)}</td>
        <td>${formatCurrency(d.totalDespesasPrevistas)}</td>
        <td>${formatCurrency(d.saldoPrevistoDia)}</td>
        <td>${formatCurrency(d.saldoAcumulado)}</td>
        <td>${formatCurrency(d.saldoBanco || 0)}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Fluxo Previsto (período)</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Fluxo Previsto (período)</h3>
      <table><thead><tr><th>Data</th><th>Receitas</th><th>Despesas</th><th>Saldo do Dia</th><th>Saldo Acumulado</th><th>Saldo Banco</th></tr></thead>
      <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const exportFluxoMensalExcel = () => {
    const rows = [
      [
        { type: 'String', value: 'Competência' },
        { type: 'String', value: 'Receitas' },
        { type: 'String', value: 'Despesas' },
        { type: 'String', value: 'Saldo' },
        { type: 'String', value: 'Saldo Acumulado' },
        { type: 'String', value: 'Saldo Banco' },
      ],
      ...fluxoMensalBanco.map((m: any) => [
        { type: 'String', value: `${String(m.mes).padStart(2, '0')}/${m.ano}` },
        { type: 'Number', value: Number(m.totalReceitasPrevistas || 0) },
        { type: 'Number', value: Number(m.totalDespesasPrevistas || 0) },
        { type: 'Number', value: Number(m.saldoPrevistoMes || 0) },
        { type: 'Number', value: Number(m.saldoAcumulado || 0) },
        { type: 'Number', value: Number(m.saldoBanco || 0) },
      ]),
    ];
    const xml = buildSpreadsheetXml('Fluxo Previsto (mensal)', rows as Array<Array<{ type: 'String' | 'Number'; value: string | number }>>);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo-previsto-mensal-${formatDateInput(dateStart)}-${formatDateInput(dateEnd)}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFluxoMensalPdf = () => {
    const htmlRows = fluxoMensalBanco.map((m: any) => `
      <tr>
        <td>${String(m.mes).padStart(2, '0')}/${m.ano}</td>
        <td>${formatCurrency(m.totalReceitasPrevistas)}</td>
        <td>${formatCurrency(m.totalDespesasPrevistas)}</td>
        <td>${formatCurrency(m.saldoPrevistoMes)}</td>
        <td>${formatCurrency(m.saldoAcumulado)}</td>
        <td>${formatCurrency(m.saldoBanco || 0)}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Fluxo Previsto (mensal)</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Fluxo Previsto (mensal)</h3>
      <table><thead><tr><th>Competência</th><th>Receitas</th><th>Despesas</th><th>Saldo</th><th>Saldo Acumulado</th><th>Saldo Banco</th></tr></thead>
      <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const balance = useMemo(() => {
    return accounts.reduce((acc, curr) => {
      const value = curr.current_balance ?? curr.initial_balance ?? 0;
      const num = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
  }, [accounts]);

  // Faturamento (emitido) e despesas por vencimento (DRE) no período selecionado
  const totalReceitaDRE = useMemo(() => {
    return incomesRaw
      .filter((i: any) => withinRange(i.data_competencia))
      .reduce((acc, i: any) => acc + getIncomeBilledValue(i), 0);
  }, [incomesRaw, dateStart, dateEnd]);

  const totalDespesaDRE = useMemo(() => {
    return expensesRaw
      .filter((e: any) => withinRange(e.data_competencia))
      .reduce((acc, e: any) => acc + (e.valor || 0), 0);
  }, [expensesRaw, dateStart, dateEnd]);

  const dreChartData = useMemo(() => {
    const map = new Map<string, { date: string; receitas: number; despesas: number; resultado: number }>();
    incomesRaw.forEach((i: any) => {
      const date = i.data_competencia;
      if (!date || !withinRange(date)) return;
      const base = new Date(date);
      const monthKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      const item = map.get(monthKey) || { date: monthKey, receitas: 0, despesas: 0, resultado: 0 };
      item.receitas += Number(i.valor_liquido || i.valor_bruto || i.valor || 0);
      map.set(monthKey, item);
    });
    expensesRaw.forEach((e: any) => {
      const date = e.data_competencia;
      if (!date || !withinRange(date)) return;
      const base = new Date(date);
      const monthKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      const item = map.get(monthKey) || { date: monthKey, receitas: 0, despesas: 0, resultado: 0 };
      item.despesas += Number(e.valor || 0);
      map.set(monthKey, item);
    });
    return Array.from(map.values())
      .map((item) => ({ ...item, resultado: item.receitas - item.despesas }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [incomesRaw, expensesRaw, dateStart, dateEnd]);

  const parcelasFiltradas = useMemo(() => {
    return cashParcels.filter((p) => withinRange(p.dataPrevista));
  }, [cashParcels, dateStart, dateEnd]);

  const fluxoDiarioBase = useMemo(() => {
    const base = gerarFluxoDiario(parcelasFiltradas);
    const map = new Map<string, any>();
    base.forEach((item) => {
      const key = item.data.toISOString().split('T')[0];
      map.set(key, item);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= dateStart && today <= dateEnd) {
      const key = today.toISOString().split('T')[0];
      if (!map.has(key)) {
        map.set(key, {
          data: today,
          totalReceitasPrevistas: 0,
          totalDespesasPrevistas: 0,
          saldoPrevistoDia: 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [parcelasFiltradas, dateStart, dateEnd]);

  const fluxoDiarioSemBanco = useMemo(() => aplicarSaldoAcumulado(fluxoDiarioBase, 0), [fluxoDiarioBase]);

  // Ajusta o saldo inicial para que o ponto de hoje reflita o saldo real em conta.
  const saldoInicialBanco = useMemo(() => {
    if (!fluxoDiarioBase.length) return balance;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < dateStart || today > dateEnd) return balance;
    const totalAteHoje = fluxoDiarioBase.reduce((acc, item) => {
      if (item.data <= today) return acc + item.saldoPrevistoDia;
      return acc;
    }, 0);
    return balance - totalAteHoje;
  }, [fluxoDiarioBase, balance, dateStart, dateEnd]);

  const fluxoDiarioFiltrado = useMemo(
    () => aplicarSaldoAcumulado(fluxoDiarioBase, saldoInicialBanco),
    [fluxoDiarioBase, saldoInicialBanco]
  );

  const cashChartData = useMemo(() => (
    fluxoDiarioFiltrado.map((d) => {
      const entrada = Number(d.totalReceitasPrevistas ?? 0);
      const saida = Number(d.totalDespesasPrevistas ?? 0);
      const saldoDia = Number(d.saldoPrevistoDia ?? entrada - saida);
      const saldo = Number(d.saldoAcumulado ?? 0);
      const saldoBanco = saldo - saldoDia;
      return {
        data: d.data.toISOString().split('T')[0],
        saldo,
        entrada,
        saida,
        saldoBanco,
      };
    })
  ), [fluxoDiarioFiltrado]);

  const fluxoDiarioTabela = useMemo(
    () => fluxoDiarioSemBanco.map((d, idx) => ({
      ...d,
      saldoBanco: fluxoDiarioFiltrado[idx]?.saldoAcumulado ?? d.saldoAcumulado,
    })),
    [fluxoDiarioSemBanco, fluxoDiarioFiltrado]
  );

  const recebimentoPrevisto = useMemo(
    () => parcelasFiltradas.filter((p) => p.tipo === 'RECEITA').reduce((acc, p) => acc + p.valor, 0),
    [parcelasFiltradas]
  );

  const pagamentoPrevisto = useMemo(
    () => parcelasFiltradas.filter((p) => p.tipo === 'DESPESA').reduce((acc, p) => acc + p.valor, 0),
    [parcelasFiltradas]
  );
  const fluxoMensal = useMemo(() => gerarFluxoMensal(parcelasFiltradas), [parcelasFiltradas]);
  const fluxoMensalAcumulado = useMemo(() => {
    let saldo = 0;
    return fluxoMensal.map((m: any) => {
      saldo += m.saldoPrevistoMes;
      return { ...m, saldoAcumulado: saldo };
    });
  }, [fluxoMensal]);
  const fluxoMensalBanco = useMemo(
    () => fluxoMensalAcumulado.map((m: any) => ({ ...m, saldoBanco: balance + m.saldoAcumulado })),
    [fluxoMensalAcumulado, balance]
  );

  const setPresetRange = (preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    if (preset === 'today') {
      setDateStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      setDateEnd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    } else if (preset === 'week') {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      setDateStart(start);
      setDateEnd(end);
    } else if (preset === 'month') {
      setDateStart(new Date(now.getFullYear(), now.getMonth(), 1));
      setDateEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else {
      setDateStart(new Date(now.getFullYear(), 0, 1));
      setDateEnd(new Date(now.getFullYear(), 11, 31));
    }
  };

  const handleTab = (next: 'dre' | 'caixa') => {
    setTab(next);
    searchParams.set('tab', next);
    setSearchParams(searchParams);
  };

  const canClearData = isSystemAdmin;

  const handleClearAllData = async () => {
    if (!isSystemAdmin) {
      setClearError('Apenas o administrador geral pode realizar esta ação.');
      return;
    }
    if (!effectiveClinicId) {
      setClearError('Selecione uma clínica antes de apagar.');
      return;
    }
    setClearLoading(true);
    setClearError(null);
    try {
      const { error } = await supabase.rpc('clear_financial_data', { p_clinic_id: effectiveClinicId });
      if (error) throw error;
      setClearModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      setClearError(err?.message || 'Erro ao apagar dados.');
    } finally {
      setClearLoading(false);
    }
  };

  const CashflowTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
        <div className="font-semibold text-gray-900">Data: {formatDate(data.data)}</div>
        <div className="mt-1 space-y-1">
          <div>Saldo Banco: {formatCurrency(data.saldoBanco ?? 0)}</div>
          <div>Entrada: {formatCurrency(data.entrada ?? 0)}</div>
          <div>Saída: {formatCurrency(data.saida ?? 0)}</div>
          <div className="font-semibold">Saldo: {formatCurrency(data.saldo ?? 0)}</div>
        </div>
      </div>
    );
  };

  const renderPeriodFilters = (variant: 'page' | 'modal') => (
    <div className={variant === 'modal' ? 'bg-white border border-gray-100 rounded-xl shadow-sm p-4' : 'bg-white p-4 rounded-xl shadow-sm border border-gray-100'}>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setPresetRange('today')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Dia</button>
          <button onClick={() => setPresetRange('week')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Semana</button>
          <button onClick={() => setPresetRange('month')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Mês</button>
          <button onClick={() => setPresetRange('year')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ano</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={formatDateInput(dateStart)}
              onChange={(e) => {
                const parsed = parseDateInput(e.target.value);
                if (parsed) setDateStart(parsed);
              }}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <span className="text-gray-400">até</span>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={formatDateInput(dateEnd)}
              onChange={(e) => {
                const parsed = parseDateInput(e.target.value);
                if (parsed) setDateEnd(parsed);
              }}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const cashChartModalControls = useModalControls({
    isOpen: isCashChartExpanded,
    onClose: () => setIsCashChartExpanded(false),
  });

  const clearModalControls = useModalControls({
    isOpen: clearModalOpen,
    onClose: () => {
      setClearModalOpen(false);
      setClearError(null);
    },
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <Loader2 size={48} className="animate-spin mb-4 text-brand-500" />
        <p>Carregando indicadores financeiros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
        <p className="text-gray-500">Resumo financeiro em tempo real</p>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTab('dre')}
          className={`px-4 py-2 text-sm rounded-lg border ${tab === 'dre' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          DRE
        </button>
        <button
          onClick={() => handleTab('caixa')}
          className={`px-4 py-2 text-sm rounded-lg border ${tab === 'caixa' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Fluxo de Caixa
        </button>
      </div>

      {/* Filtros de período */}
      {renderPeriodFilters('page')}

      {tab === 'dre' && (
        <>
          {/* KPI Cards DRE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Saldo em Contas</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(balance)}</h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <Wallet size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Receitas Faturadas (competência)</p>
                <h3 className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitaDRE)}</h3>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                <ArrowUpCircle size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Despesas (competência)</p>
                <h3 className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesaDRE)}</h3>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                <ArrowDownCircle size={24} />
              </div>
            </div>
          </div>

          {/* DRE simples */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">DRE (competência)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-gray-100 bg-green-50">
                <p className="text-xs uppercase text-gray-600">Receitas (faturado)</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceitaDRE)}</p>
              </div>
              <div className="p-4 rounded-lg border border-gray-100 bg-red-50">
                <p className="text-xs uppercase text-gray-600">Despesas</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(totalDespesaDRE)}</p>
              </div>
              <div className="p-4 rounded-lg border border-gray-100 bg-blue-50">
                <p className="text-xs uppercase text-gray-600">Resultado</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(totalReceitaDRE - totalDespesaDRE)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">DRE (competência) • Entradas x Despesas</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => exportChartPng(dreChartRef.current, 'dre-competencia')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => exportChartPdf(dreChartRef.current, 'DRE (competência)')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="h-80" ref={dreChartRef}>
              {dreChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dreChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatMonthYear} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val / 1000).toFixed(1)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label: string) => `Mês: ${formatMonthYear(label)}`}
                    />
                    <Bar dataKey="receitas" name="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="resultado" name="Resultado" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Sem dados para o período selecionado.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'caixa' && (
        <>
          {canClearData && (
            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">Limpeza de dados financeiros</p>
                <p className="text-xs text-gray-600">
                  Remove todas as receitas e despesas da clínica selecionada. Ação irreversível.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!effectiveClinicId && (
                  <span className="text-xs text-gray-500">Selecione uma clínica no topo.</span>
                )}
                <button
                  type="button"
                  onClick={() => setClearModalOpen(true)}
                  disabled={!effectiveClinicId || clearLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Limpar receitas e despesas
                </button>
              </div>
            </div>
          )}

          {/* Diferença Faturamento (emitido) vs Caixa previsto do mês */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500">Faturamento emitido (mês)</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(totalReceitaDRE)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500">Recebimento previsto caixa  (filtro)</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(recebimentoPrevisto)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500">Pagamento previsto caixa (mês)</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(pagamentoPrevisto)}</p>
            </div>
          </div>

          {!isCashChartExpanded && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Fluxo de Caixa (Saldo Previsto)+ Saldo Banco </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCashChartMode('linha')}
                    className={`px-3 py-2 text-sm border rounded-lg ${cashChartMode === 'linha' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    Linha
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashChartMode('coluna')}
                    className={`px-3 py-2 text-sm border rounded-lg ${cashChartMode === 'coluna' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    Coluna
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCashChartExpanded(true)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Tela cheia
                  </button>
                </div>
              </div>
              <div className="h-72">
                {fluxoDiarioFiltrado.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {cashChartMode === 'linha' ? (
                      <LineChart data={cashChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatDate} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val/1000).toFixed(1)}k`} />
                        <Tooltip content={<CashflowTooltip />} />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                        <Line type="linear" dataKey="saldo" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={cashChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatDate} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val/1000).toFixed(1)}k`} />
                        <Tooltip content={<CashflowTooltip />} />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                        <Bar dataKey="saldo" name="Saldo" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Nenhuma previsão no período.
                  </div>
                )}
              </div>
            </div>
          )}

          {isCashChartExpanded && (
            <div
              className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6"
              onClick={cashChartModalControls.onBackdropClick}
            >
              <div
                className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Fluxo de Caixa (Saldo Previsto)+ Saldo Banco </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCashChartMode('linha')}
                      className={`px-3 py-2 text-sm border rounded-lg ${cashChartMode === 'linha' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
                    >
                      Linha
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashChartMode('coluna')}
                      className={`px-3 py-2 text-sm border rounded-lg ${cashChartMode === 'coluna' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
                    >
                      Coluna
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCashChartExpanded(false)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  {renderPeriodFilters('modal')}
                </div>
                <div className="relative flex-1 min-h-[360px]">
                  {fluxoDiarioFiltrado.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {cashChartMode === 'linha' ? (
                        <LineChart data={cashChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatDate} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val/1000).toFixed(1)}k`} />
                          <Tooltip content={<CashflowTooltip />} />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                          <Line type="linear" dataKey="saldo" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                        </LineChart>
                      ) : (
                        <BarChart data={cashChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatDate} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val/1000).toFixed(1)}k`} />
                          <Tooltip content={<CashflowTooltip />} />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                          <Bar dataKey="saldo" name="Saldo" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                      Nenhuma previsão no período.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fluxo previsto mensal (período selecionado) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Fluxo Previsto (mensal)</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportFluxoMensalExcel}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportFluxoMensalPdf}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2">Competência</th>
                    <th className="px-4 py-2 text-right">Receitas</th>
                    <th className="px-4 py-2 text-right">Despesas</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                    <th className="px-4 py-2 text-right">Saldo Acumulado</th>
                    <th className="px-4 py-2 text-right">Saldo Banco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fluxoMensalBanco.map((m: any) => (
                    <tr key={`${m.ano}-${m.mes}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{formatMonthYear(`${m.ano}-${String(m.mes).padStart(2, '0')}`)}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(m.totalReceitasPrevistas)}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(m.totalDespesasPrevistas)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(m.saldoPrevistoMes)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(m.saldoAcumulado)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(m.saldoBanco || 0)}</td>
                    </tr>
                  ))}
                  {fluxoMensalBanco.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-gray-400">Sem previsões mensais.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fluxo previsto diário (período selecionado) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Fluxo Previsto (período)</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportFluxoDiarioExcel}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportFluxoDiarioPdf}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2 text-right">Receitas</th>
                    <th className="px-4 py-2 text-right">Despesas</th>
                    <th className="px-4 py-2 text-right">Saldo do Dia</th>
                    <th className="px-4 py-2 text-right">Saldo Acumulado</th>
                    <th className="px-4 py-2 text-right">Saldo Banco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fluxoDiarioTabela.map((d: any) => (
                    <tr key={d.data.toString()} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{d.data.toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(d.totalReceitasPrevistas)}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(d.totalDespesasPrevistas)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(d.saldoPrevistoDia)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(d.saldoAcumulado)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(d.saldoBanco || 0)}</td>
                    </tr>
                  ))}
                  {fluxoDiarioTabela.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-gray-400">Sem previsões registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/20 p-4"
          onClick={clearModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full border border-red-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-5 border-b border-red-100">
              <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Ação irreversível</h3>
                <p className="text-sm text-gray-600">
                  Você está prestes a apagar todas as receitas e despesas da clínica selecionada.
                  Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Clínica:</span> {effectiveClinicId ? effectiveClinicId : 'Não selecionada'}
              </p>
              {clearError && (
                <p className="text-sm text-red-600">{clearError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 bg-red-50/60">
              <button
                type="button"
                onClick={() => { setClearModalOpen(false); setClearError(null); }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-white"
                disabled={clearLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={clearLoading || !effectiveClinicId}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {clearLoading ? 'Apagando...' : 'Sim, apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
