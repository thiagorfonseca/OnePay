import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Clock, CreditCard, Percent, Pencil, Users, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

const PricingCalculator: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const storageKey = useMemo(
    () => `pricing-calculator-settings:${clinicId || 'default'}`,
    [clinicId]
  );
  const [expenses, setExpenses] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [totalCostsInput, setTotalCostsInput] = useState('');
  const [hoursAvailableInput, setHoursAvailableInput] = useState('120');
  const [occupancyInput, setOccupancyInput] = useState('50');
  const [taxInput, setTaxInput] = useState('15');
  const [marginInput, setMarginInput] = useState('20');
  const [cardFeeInput, setCardFeeInput] = useState('2,5');
  const [commissionInput, setCommissionInput] = useState('20');
  const [manualCosts, setManualCosts] = useState(false);
  const [procedureFilter, setProcedureFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'recommended' | 'worked' | 'hours' | 'rentability' | 'commission'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingProcedure, setEditingProcedure] = useState<any | null>(null);
  const [savingProcedure, setSavingProcedure] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const parseNumber = (value: string) => {
    const raw = value.trim().replace(/[^0-9,.-]/g, '');
    if (!raw) return 0;
    const hasComma = raw.includes(',');
    const normalized = hasComma ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  };

  const parsePercent = (value: string) => {
    const num = parseNumber(value);
    return num / 100;
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const procedureModalControls = useModalControls({
    isOpen: !!editingProcedure,
    onClose: () => setEditingProcedure(null),
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let expQuery = supabase.from('pricing_expenses').select('*').order('created_at', { ascending: false });
        let procQuery = supabase.from('procedures').select('*').order('created_at', { ascending: false });
        if (clinicId) {
          expQuery = expQuery.eq('clinic_id', clinicId);
          procQuery = procQuery.eq('clinic_id', clinicId);
        }
        const [{ data: expData }, { data: procData }] = await Promise.all([expQuery, procQuery]);
        setExpenses(expData || []);
        setProcedures(procData || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clinicId]);

  const totalCostsFromDb = useMemo(() => {
    return expenses.reduce((acc, item) => {
      const val = Number(item.valor_calculado ?? item.valor_base ?? 0);
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [expenses]);

  useEffect(() => {
    if (manualCosts) return;
    setTotalCostsInput(totalCostsFromDb ? formatCurrency(totalCostsFromDb) : formatCurrency(0));
  }, [totalCostsFromDb, manualCosts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSettingsLoaded(true);
        return;
      }
      const data = JSON.parse(raw);
      if (data.hoursAvailableInput) setHoursAvailableInput(String(data.hoursAvailableInput));
      if (data.occupancyInput) setOccupancyInput(String(data.occupancyInput));
      if (data.taxInput) setTaxInput(String(data.taxInput));
      if (data.marginInput) setMarginInput(String(data.marginInput));
      if (data.cardFeeInput) setCardFeeInput(String(data.cardFeeInput));
      if (data.commissionInput) setCommissionInput(String(data.commissionInput));
      if (data.totalCostsInput) setTotalCostsInput(String(data.totalCostsInput));
      if (typeof data.manualCosts === 'boolean') setManualCosts(data.manualCosts);
    } catch (err) {
      console.warn('Falha ao carregar configurações de precificação.', err);
    } finally {
      setSettingsLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !settingsLoaded) return;
    const payload = {
      hoursAvailableInput,
      occupancyInput,
      taxInput,
      marginInput,
      cardFeeInput,
      commissionInput,
      totalCostsInput,
      manualCosts,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    settingsLoaded,
    storageKey,
    hoursAvailableInput,
    occupancyInput,
    taxInput,
    marginInput,
    cardFeeInput,
    commissionInput,
    totalCostsInput,
    manualCosts,
  ]);

  const totalCosts = manualCosts ? parseNumber(totalCostsInput) : totalCostsFromDb;
  const hoursAvailable = parseNumber(hoursAvailableInput);
  const occupancyRate = parsePercent(occupancyInput);
  const taxRate = parsePercent(taxInput);
  const marginRate = parsePercent(marginInput);
  const cardRate = parsePercent(cardFeeInput);
  const commissionRate = parsePercent(commissionInput);

  const costPerHour = useMemo(() => {
    const denom = hoursAvailable * (occupancyRate || 0);
    if (!denom) return 0;
    return totalCosts / denom;
  }, [totalCosts, hoursAvailable, occupancyRate]);

  const totalRates = taxRate + marginRate + commissionRate + cardRate;

  const procedureOptions = useMemo(() => {
    return procedures.map((p) => ({
      id: p.id,
      label: p.procedimento || 'Procedimento',
    }));
  }, [procedures]);

  const baseRows = useMemo(() => {
    return procedures
      .filter((p) => !procedureFilter || p.id === procedureFilter)
      .map((p) => {
        const durationMinutes = Number(p.tempo_minutos ?? 0);
        const durationHours = durationMinutes ? durationMinutes / 60 : 0;
        const insumo = Number(p.custo_insumo ?? 0);
        const serviceCost = costPerHour * durationHours + insumo;
        const divisor = 1 - totalRates;
        const recommended = divisor > 0 ? serviceCost / divisor : 0;
        const worked = Number(p.valor_cobrado ?? 0);
        const baseValue = worked || recommended;
        const rentability = baseValue - serviceCost;
        const commissionValue = baseValue * commissionRate;
        return {
          id: p.id,
          name: p.procedimento || 'Procedimento',
          categoria: p.categoria || '',
          tempo_minutos: p.tempo_minutos ?? null,
          custo_insumo: p.custo_insumo ?? null,
          valor_cobrado: p.valor_cobrado ?? null,
          recommended,
          worked,
          durationHours,
          rentability,
          commissionValue,
        };
      });
  }, [procedures, procedureFilter, costPerHour, totalRates, commissionRate]);

  type ProcedureClass = { type: 'estrela' | 'vaca' | 'abacaxi'; percent: number };

  const classifyProcedure = (rentability: number, durationHours: number): ProcedureClass => {
    if (!costPerHour || !durationHours) return { type: 'vaca', percent: 0 };
    const profitPerHour = rentability / durationHours;
    const percentOfCostHour = (profitPerHour / costPerHour) * 100;
    if (percentOfCostHour < 0) return { type: 'abacaxi', percent: percentOfCostHour };
    if (percentOfCostHour <= 50) return { type: 'vaca', percent: percentOfCostHour };
    return { type: 'estrela', percent: percentOfCostHour };
  };

  const typeIcon = (type: 'estrela' | 'vaca' | 'abacaxi') => {
    if (type === 'estrela') return '⭐';
    if (type === 'abacaxi') return '🍍';
    return '🐄';
  };

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...baseRows].sort((a, b) => {
      const asText = (val: string) => val.toLowerCase();
      switch (sortKey) {
        case 'name':
          return asText(a.name).localeCompare(asText(b.name)) * dir;
        case 'recommended':
          return ((a.recommended || 0) - (b.recommended || 0)) * dir;
        case 'worked':
          return ((a.worked || 0) - (b.worked || 0)) * dir;
        case 'hours':
          return ((a.durationHours || 0) - (b.durationHours || 0)) * dir;
        case 'rentability':
          return ((a.rentability || 0) - (b.rentability || 0)) * dir;
        case 'commission':
          return ((a.commissionValue || 0) - (b.commissionValue || 0)) * dir;
        default:
          return 0;
      }
    });
  }, [baseRows, sortKey, sortDir]);

  const exportPdf = () => {
    const headers = ['Serviço', 'Valor recomendado', 'Valor trabalhado', 'Horas gastas', 'Rentabilidade', 'Comissão/Parceiro'];
    const htmlRows = rows
      .map((row) => {
        const classification = classifyProcedure(row.rentability, row.durationHours);
        const icon = typeIcon(classification.type);
        return `
        <tr>
          <td>${icon} ${row.name}</td>
          <td>${formatCurrency(row.recommended || 0)}</td>
          <td>${row.worked ? formatCurrency(row.worked) : '-'}</td>
          <td>${row.durationHours.toFixed(2)}</td>
          <td>${formatCurrency(row.rentability || 0)}</td>
          <td>${formatCurrency(row.commissionValue || 0)}</td>
        </tr>
      `;
      })
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>OneFinc • Calculadora de Precificação</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
          .brand h1 { font-size: 20px; margin: 0; }
          .brand p { margin: 0; font-size: 12px; color: #6b7280; }
          table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .meta { font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="brand">
          <div>
            <h1>OneFinc</h1>
            <p>Precificação • Calculadora</p>
          </div>
        </div>
        <div class="meta">Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>${htmlRows || `<tr><td colspan="6">Nenhum procedimento encontrado.</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const handleSaveProcedure = async () => {
    if (!editingProcedure) return;
    setSavingProcedure(true);
    try {
      const payload = {
        procedimento: editingProcedure.procedimento,
        categoria: editingProcedure.categoria || null,
        tempo_minutos: editingProcedure.tempo_minutos ? parseNumber(String(editingProcedure.tempo_minutos)) : null,
        custo_insumo: editingProcedure.custo_insumo ? parseNumber(String(editingProcedure.custo_insumo)) : null,
        valor_cobrado: editingProcedure.valor_cobrado ? parseNumber(String(editingProcedure.valor_cobrado)) : null,
      };
      const { error } = await supabase.from('procedures').update(payload).eq('id', editingProcedure.id);
      if (error) throw error;
      setProcedures((prev) =>
        prev.map((p) => (p.id === editingProcedure.id ? { ...p, ...payload } : p))
      );
      setEditingProcedure(null);
    } catch (err: any) {
      alert('Erro ao salvar procedimento: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setSavingProcedure(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Calculadora</h1>
        <p className="text-gray-500">Precificação • Calculadora</p>
      </div>

      {loading && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">
          Carregando dados de custos e procedimentos...
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Wallet size={16} /> Custos
              </div>
              <input
                value={totalCostsInput}
                onChange={(e) => {
                  setTotalCostsInput(e.target.value);
                  setManualCosts(true);
                }}
                onBlur={() => {
                  const val = parseNumber(totalCostsInput);
                  setTotalCostsInput(formatCurrency(val));
                }}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setManualCosts(false)}
                className="mt-1 text-[11px] text-brand-600"
              >
                Usar custos calculados ({formatCurrency(totalCostsFromDb)})
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Clock size={16} /> Horas disponíveis
              </div>
              <input
                value={hoursAvailableInput}
                onChange={(e) => setHoursAvailableInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Percent size={16} /> Taxa de ocupação
              </div>
              <input
                value={occupancyInput}
                onChange={(e) => setOccupancyInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Percent size={16} /> Impostos
              </div>
              <input
                value={taxInput}
                onChange={(e) => setTaxInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Percent size={16} /> Margem desejada
              </div>
              <input
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <CreditCard size={16} /> Taxa de cartão
              </div>
              <input
                value={cardFeeInput}
                onChange={(e) => setCardFeeInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Users size={16} /> Comissão/Parceiros
              </div>
              <input
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="mt-1 w-full text-lg font-semibold text-gray-800 bg-transparent outline-none"
              />
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
              <div className="flex items-center gap-2 text-blue-700 text-xs">
                <Calculator size={16} /> custo hora clinica
              </div>
              <p className="mt-1 text-lg font-semibold text-blue-700">{formatCurrency(costPerHour || 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Lista de procedimentos</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportPdf}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Baixar PDF
                </button>
                <select
                  value={procedureFilter}
                  onChange={(e) => setProcedureFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                >
                  <option value="">Todos</option>
                  {procedureOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('name')}>
                      Serviço {sortKey === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('recommended')}>
                      Valor recomendado {sortKey === 'recommended' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('worked')}>
                      Valor trabalhado {sortKey === 'worked' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('hours')}>
                      Horas gastas {sortKey === 'hours' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('rentability')}>
                      Rentabilidade {sortKey === 'rentability' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10 cursor-pointer" onClick={() => toggleSort('commission')}>
                      Comissão/Parceiro {sortKey === 'commission' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-2 text-right sticky top-0 bg-white z-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const classification = classifyProcedure(row.rentability, row.durationHours);
                    return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">
                        <span className="mr-2">{typeIcon(classification.type)}</span>
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-right text-brand-700 font-medium">{formatCurrency(row.recommended || 0)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{row.worked ? formatCurrency(row.worked) : '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{row.durationHours.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(row.rentability || 0)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(row.commissionValue || 0)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingProcedure({
                            id: row.id,
                            procedimento: row.name,
                            categoria: row.categoria,
                            tempo_minutos: row.tempo_minutos ?? '',
                            custo_insumo: row.custo_insumo ?? '',
                            valor_cobrado: row.valor_cobrado ?? '',
                          })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Nenhum procedimento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingProcedure && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={procedureModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Editar procedimento</h3>
              <button
                type="button"
                onClick={() => setEditingProcedure(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
                <input
                  value={editingProcedure.procedimento}
                  onChange={(e) => setEditingProcedure((prev: any) => ({ ...prev, procedimento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  value={editingProcedure.categoria || ''}
                  onChange={(e) => setEditingProcedure((prev: any) => ({ ...prev, categoria: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tempo (min)</label>
                  <input
                    value={editingProcedure.tempo_minutos}
                    onChange={(e) => setEditingProcedure((prev: any) => ({ ...prev, tempo_minutos: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo insumo</label>
                  <input
                    value={editingProcedure.custo_insumo}
                    onChange={(e) => setEditingProcedure((prev: any) => ({ ...prev, custo_insumo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor cobrado</label>
                  <input
                    value={editingProcedure.valor_cobrado}
                    onChange={(e) => setEditingProcedure((prev: any) => ({ ...prev, valor_cobrado: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProcedure(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProcedure}
                disabled={savingProcedure}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60"
              >
                {savingProcedure ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingCalculator;
