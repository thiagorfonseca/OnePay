import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, Loader2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BankAccount } from '../types';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';

const BankAccounts: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const effectiveClinic = clinicId || null;
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    bank: '',
    initial_balance: '0,00',
    current_balance: '0,00',
  });

  const parseBalanceValue = (value: any) => {
    if (typeof value === 'string') {
      const num = Number(value.replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    const num = Number(value || 0);
    return isNaN(num) ? 0 : num;
  };

  const recalcAccountBalances = async (accountList: BankAccount[]) => {
    if (!effectiveClinic || accountList.length === 0) return accountList;
    const [revenuesRes, expensesRes] = await Promise.all([
      supabase
        .from('revenues')
        .select('bank_account_id, valor_liquido, valor_bruto, valor, status, data_competencia, data_recebimento, parcelas, forma_pagamento, recebimento_parcelas')
        .eq('clinic_id', effectiveClinic),
      supabase
        .from('expenses')
        .select('bank_account_id, valor, status')
        .eq('clinic_id', effectiveClinic)
        .eq('status', 'paid'),
    ]);

    const revenues = revenuesRes.data || [];
    const expenses = expensesRes.data || [];

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

    // Calcula recebimento considerando regras por forma de pagamento e parcelas manuais.
    const getReceitaRecebida = (r: any) => {
      const total = Number(r.valor_liquido ?? r.valor_bruto ?? r.valor ?? 0);
      if (!Number.isFinite(total) || total === 0) return 0;
      const manualDates = parseManualParcelas(r.recebimento_parcelas)
        .map(p => toDate(p.vencimento))
        .filter(Boolean) as Date[];
      const parcelas = Math.max(1, manualDates.length || parseInt(r.parcelas || '1', 10) || 1);
      const forma = normalizeForma(r.forma_pagamento);
      const baseReceb = toDate(r.data_recebimento);
      const comp = toDate(r.data_competencia);
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
      for (let i = 0; i < parcelas; i += 1) {
        let dataPrevista = manualDates[i] || base;
        if (!dataPrevista) continue;
        if (!manualDates[i]) {
          if (intervalDays && i > 0) dataPrevista = addDaysToDate(base as Date, intervalDays * i);
          else if (!intervalDays && parcelas > 1 && i > 0) dataPrevista = addMonthsToDate(base as Date, i);
        }
        if (dataPrevista <= today) recebido += valores[i] || 0;
      }
      return recebido;
    };

    const receitaPorConta = new Map<string, number>();
    revenues.forEach((r: any) => {
      if (!r.bank_account_id) return;
      const value = getReceitaRecebida(r);
      if (!Number.isFinite(value) || value === 0) return;
      receitaPorConta.set(r.bank_account_id, (receitaPorConta.get(r.bank_account_id) || 0) + value);
    });

    const despesaPorConta = new Map<string, number>();
    expenses.forEach((e: any) => {
      if (!e.bank_account_id) return;
      const value = Number(e.valor ?? 0);
      if (!Number.isFinite(value)) return;
      despesaPorConta.set(e.bank_account_id, (despesaPorConta.get(e.bank_account_id) || 0) + value);
    });

    const updates: Array<{ id: string; current_balance: number }> = [];
    const recalculated = accountList.map((acc: any) => {
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

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      if (!effectiveClinic) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      let query = supabase.from('bank_accounts').select('*');
      if (effectiveClinic) query = query.eq('clinic_id', effectiveClinic);
      const { data, error } = await query;
      if (error) throw error;
      const list = (data as any) || [];
      const recalculated = await recalcAccountBalances(list);
      setAccounts(recalculated as any || []);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [effectiveClinic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!effectiveClinic) {
        alert('Selecione uma clínica antes de salvar.');
        return;
      }
      const initialBalance = parseBalanceValue(formData.initial_balance);
      if (editingId) {
        const editingAccount = accounts.find((acc) => acc.id === editingId);
        const existingCurrent = parseBalanceValue(editingAccount?.current_balance ?? editingAccount?.initial_balance ?? 0);
        const existingInitial = parseBalanceValue(editingAccount?.initial_balance ?? 0);
        const desiredCurrent = parseBalanceValue(formData.current_balance);
        const delta = desiredCurrent - existingCurrent;
        const nextInitial = existingInitial + delta;
        const { error } = await supabase
          .from('bank_accounts')
          .update({
            nome_conta: formData.name,
            banco: formData.bank,
            current_balance: desiredCurrent,
            initial_balance: nextInitial,
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_accounts').insert([{
          nome_conta: formData.name, // Mapeando para o schema correto
          banco: formData.bank,
          initial_balance: initialBalance,
          current_balance: initialBalance, // Inicialmente igual
          ativo: true,
          clinic_id: effectiveClinic,
        }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', bank: '', initial_balance: '0,00', current_balance: '0,00' });
      fetchAccounts();
    } catch (error: any) {
      alert('Erro ao salvar conta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (acc: any) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.nome_conta || acc.name || '',
      bank: acc.banco || acc.bank || '',
      initial_balance: String((acc.initial_balance ?? acc.current_balance ?? 0)).replace('.', ','),
      current_balance: String((acc.current_balance ?? acc.initial_balance ?? 0)).replace('.', ','),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso pode afetar transações vinculadas.')) return;
    try {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
      fetchAccounts();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contas Bancárias</h1>
          <p className="text-gray-500">Gerencie onde o dinheiro entra e sai</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus size={20} /> Nova Conta
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-48 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(acc)} className="text-gray-400 hover:text-brand-600">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(acc.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{acc.name || (acc as any).nome_conta}</h3>
                  <p className="text-sm text-gray-500">{acc.bank || (acc as any).banco}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Saldo Atual</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency((acc as any).current_balance || 0)}
                </p>
              </div>
            </div>
          ))}
          
          {accounts.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">Nenhuma conta cadastrada.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Conta (Apelido)</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ex: Itaú Principal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <input
                  required
                  value={formData.bank}
                  onChange={e => setFormData({...formData, bank: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ex: Itaú, Nubank, Caixa"
                />
              </div>
              <div>
                {editingId ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Atual (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.current_balance}
                      onChange={e => setFormData({ ...formData, current_balance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.initial_balance}
                      onChange={e => setFormData({ ...formData, initial_balance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccounts;
