import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Plus, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';

type ExpenseCategory = 'Recursos Humanos C.L.T' | 'Recursos Humanos P.J.' | 'Tecnologia' | 'Custo';

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'Recursos Humanos C.L.T', label: 'Recursos Humanos C.L.T' },
  { value: 'Recursos Humanos P.J.', label: 'Recursos Humanos P.J.' },
  { value: 'Tecnologia', label: 'Tecnologia' },
  { value: 'Custo', label: 'Custo' },
];

const detectCsvSeparator = (line: string) => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

const parseCsvLine = (line: string, separator: string) => {
  const out: string[] = [];
  let current = '';
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (ch === separator && !insideQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((value) => value.trim());
};

const parseCurrencyValue = (value: string) => {
  const raw = value.trim().replace(/[^0-9,.-]/g, '');
  if (!raw) return null;
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  let normalized = raw;
  if (hasComma) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    normalized = raw;
  } else {
    normalized = raw;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const normalizeCategory = (value: string): ExpenseCategory | null => {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const cleaned = raw.replace(/[^a-z]/g, '');
  if (cleaned.includes('clt')) return 'Recursos Humanos C.L.T';
  if (cleaned.includes('pj') || cleaned.includes('mei') || cleaned.includes('outros')) return 'Recursos Humanos P.J.';
  if (cleaned.includes('tecnologia') || cleaned.includes('tec')) return 'Tecnologia';
  if (cleaned.includes('custo')) return 'Custo';
  return null;
};

const calculateMonthlyValue = (baseValue: number, category: ExpenseCategory) => {
  if (category === 'Recursos Humanos C.L.T') {
    return baseValue * 1.8;
  }
  if (category === 'Tecnologia') {
    const months = 60;
    const rate = 0.01;
    const futureValue = baseValue * Math.pow(1 + rate, months);
    return futureValue / months;
  }
  if (category === 'Custo') {
    return baseValue;
  }
  return baseValue;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const PricingExpenses: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [form, setForm] = useState({
    categoria: 'Recursos Humanos C.L.T' as ExpenseCategory,
    nome: '',
    valor_base: '',
  });

  const formatCsvNumber = (value: number) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    return num.toFixed(2).replace('.', ',');
  };

  const escapeCsv = (value: string | number) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[";\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const exportTable = (format: 'csv' | 'pdf') => {
    const headers = ['ID', 'Gasto', 'Categoria', 'Valor'];
    const rows = expensesWithCalc.map((row, idx) => [
      idx + 1,
      row.nome || '',
      row.categoria || '',
      formatCsvNumber(row.valor_calculado || 0),
    ]);

    if (format === 'csv') {
      const csv = [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join('\n');
      const content = `\uFEFF${csv}`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'gastos-precificacao.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const htmlRows = rows
      .map((r) => `<tr>${r.map((c) => `<td style="padding:6px;border:1px solid #ddd;font-size:12px;">${c}</td>`).join('')}</tr>`)
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Gastos</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Gastos (precificação)</h3>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const fetchExpenses = async () => {
    let query = supabase.from('pricing_expenses').select('*').order('created_at', { ascending: false });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setExpenses(data as any[]);
  };

  useEffect(() => {
    fetchExpenses();
  }, [clinicId]);

  const expensesWithCalc = useMemo(() => {
    return expenses.map((exp) => {
      const categoria = (exp.categoria || 'Recursos Humanos P.J.') as ExpenseCategory;
      const baseValue = Number(exp.valor_base ?? exp.valor ?? 0);
      const valorCalculado =
        exp.valor_calculado != null ? Number(exp.valor_calculado) : calculateMonthlyValue(baseValue, categoria);
      return {
        ...exp,
        categoria,
        valor_base: baseValue,
        valor_calculado: valorCalculado,
      };
    });
  }, [expenses]);

  const totals = useMemo(() => {
    const sum = (items: typeof expensesWithCalc, categoria: ExpenseCategory) =>
      items.filter((item) => item.categoria === categoria).reduce((acc, item) => acc + (item.valor_calculado || 0), 0);
    const totalClt = sum(expensesWithCalc, 'Recursos Humanos C.L.T');
    const totalPj = sum(expensesWithCalc, 'Recursos Humanos P.J.');
    const totalTech = sum(expensesWithCalc, 'Tecnologia');
    const totalCusto = sum(expensesWithCalc, 'Custo');
    const total = totalClt + totalPj + totalTech + totalCusto;
    return { totalClt, totalPj, totalTech, totalCusto, total };
  }, [expensesWithCalc]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ categoria: 'Recursos Humanos C.L.T', nome: '', valor_base: '' });
    setShowModal(true);
  };

  const openEditModal = (row: any) => {
    setEditingId(row.id);
    setForm({
      categoria: (row.categoria || 'Recursos Humanos P.J.') as ExpenseCategory,
      nome: row.nome || '',
      valor_base: row.valor_base != null ? String(row.valor_base) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicId) {
      alert('Nenhuma clínica ativa para salvar despesas.');
      return;
    }
    if (!form.nome.trim()) return;
    const baseValue = parseCurrencyValue(form.valor_base);
    if (baseValue == null) {
      alert('Informe um valor válido.');
      return;
    }
    const valorCalculado = roundCurrency(calculateMonthlyValue(baseValue, form.categoria));
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        categoria: form.categoria,
        nome: form.nome.trim(),
        valor_base: roundCurrency(baseValue),
        valor_calculado: valorCalculado,
      };
      if (editingId) {
        const { error } = await supabase.from('pricing_expenses').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pricing_expenses').insert([payload]);
        if (error) throw error;
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ categoria: 'Recursos Humanos C.L.T', nome: '', valor_base: '' });
      fetchExpenses();
    } catch (err: any) {
      alert('Erro ao salvar despesa: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gastos</h1>
          <p className="text-gray-500">Precificação • Gastos</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} /> Nova despesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Recursos Humanos (CLT)</p>
          <p className="text-lg font-semibold text-gray-800">{formatCurrency(totals.totalClt)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Recursos Humanos (P.J.)</p>
          <p className="text-lg font-semibold text-gray-800">{formatCurrency(totals.totalPj)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Tecnologia</p>
          <p className="text-lg font-semibold text-gray-800">{formatCurrency(totals.totalTech)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Custo</p>
          <p className="text-lg font-semibold text-gray-800">{formatCurrency(totals.totalCusto)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-semibold text-gray-800">{formatCurrency(totals.total)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('Categoria,Nome,Valor\nRecursos Humanos C.L.T,Salário equipe,1000\nRecursos Humanos P.J.,Consultoria,5000\nTecnologia,Equipamento,100000\nCusto,Aluguel,2000')}`}
              download="modelo_gastos_precificacao.csv"
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
            >
              <Download size={14} /> Modelo CSV
            </a>
            <label
              className={`px-3 py-2 text-sm bg-brand-600 text-white rounded-lg flex items-center gap-2 cursor-pointer hover:bg-brand-700 ${uploadingCsv ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <Upload size={14} /> {uploadingCsv ? 'Importando...' : 'Importar CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  if (!clinicId) {
                    alert('Nenhuma clínica ativa para importar gastos.');
                    return;
                  }
                  const file = e.target.files[0];
                  setUploadingCsv(true);
                  try {
                    const text = (await file.text()).replace(/^\uFEFF/, '');
                    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
                    if (!lines.length) throw new Error('Arquivo vazio');

                    const separator = detectCsvSeparator(lines[0]);
                    const parseLine = (line: string) => parseCsvLine(line, separator);
                    const header = parseLine(lines[0]).map((value) => value.toLowerCase());
                    const hasHeader = header.some((value) => value.includes('categoria') || value.includes('nome'));
                    const dataLines = hasHeader ? lines.slice(1) : lines;

                    const findIdx = (needle: string[]) => {
                      const idx = header.findIndex((value) => needle.some((n) => value.includes(n)));
                      return idx >= 0 ? idx : -1;
                    };
                    const idxCategoria = hasHeader ? findIdx(['categoria']) : -1;
                    const idxNome = hasHeader ? findIdx(['nome', 'gasto']) : -1;
                    const idxValor = hasHeader ? findIdx(['valor']) : -1;

                    const payload = dataLines
                      .map((row) => {
                        const cols = parseLine(row);
                        const shift = !hasHeader && cols.length >= 3 ? 0 : 0;
                        const pick = (idxHeader: number, fallback: number) => {
                          const idx = idxHeader >= 0 ? idxHeader : fallback;
                          return cols[idx] ?? '';
                        };
                        const categoriaRaw = pick(idxCategoria, shift + 0);
                        const nome = pick(idxNome, shift + 1);
                        const valor = pick(idxValor, shift + 2);
                        const categoria = normalizeCategory(categoriaRaw);
                        const baseValue = parseCurrencyValue(valor);
                        if (!categoria || !nome || baseValue == null) return null;
                        const valorCalculado = roundCurrency(calculateMonthlyValue(baseValue, categoria));
                        return {
                          clinic_id: clinicId,
                          categoria,
                          nome,
                          valor_base: roundCurrency(baseValue),
                          valor_calculado: valorCalculado,
                        };
                      })
                      .filter(Boolean) as any[];

                    if (!payload.length) {
                      alert('Nenhuma linha válida encontrada no CSV.');
                      return;
                    }
                    const { error } = await supabase.from('pricing_expenses').insert(payload);
                    if (error) throw error;
                    fetchExpenses();
                  } catch (err: any) {
                    alert('Erro ao importar CSV: ' + err.message);
                  } finally {
                    setUploadingCsv(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportTable('pdf')}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg"
            >
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={() => exportTable('csv')}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg"
            >
              Baixar CSV
            </button>
          </div>
        </div>

        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Gasto</th>
                <th className="px-4 py-2 text-left">Categoria</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expensesWithCalc.map((row, idx) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{idx + 1}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{row.nome}</td>
                  <td className="px-4 py-2 text-gray-700">{row.categoria}</td>
                  <td className="px-4 py-2 text-right text-gray-800">{formatCurrency(row.valor_calculado || 0)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => openEditModal(row)}
                      className="text-brand-600 text-sm mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Excluir despesa?')) return;
                        const { error } = await supabase.from('pricing_expenses').delete().eq('id', row.id);
                        if (!error) fetchExpenses();
                      }}
                      className="text-red-600 text-sm"
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
              {expensesWithCalc.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    Nenhuma despesa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar despesa' : 'Nova despesa'}
              </h4>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria do gasto</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value as ExpenseCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  placeholder="Ex: Salário equipe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                <input
                  value={form.valor_base}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor_base: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  placeholder="Ex: 1000"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {editingId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingExpenses;
