import React, { useState, useEffect, useMemo } from 'react';
import { Upload, CheckCircle, AlertCircle, PlusCircle, Link as LinkIcon, Loader2, Search, EyeOff, Eye } from 'lucide-react';
import { parseOFX, formatCurrency, formatDate } from '../lib/utils';
import { BankAccount, Category } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

const Reconciliation: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const effectiveClinic = clinicId || null;

  // State
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Data State
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null); // Transaction being conciliated
  const [categories, setCategories] = useState<Category[]>([]);
  const [candidateMatches, setCandidateMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const [showOnlyConciliated, setShowOnlyConciliated] = useState(false);
  const [archivedHidden, setArchivedHidden] = useState(true);
  const [reopenTarget, setReopenTarget] = useState<any>(null);
  const [reopenLoading, setReopenLoading] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    category_id: '',
    description: '',
    entity_name: '' // Fornecedor/Paciente
  });

  const amountTolerance = useMemo(() => {
    if (!selectedTx) return 0;
    const value = Math.abs(Number(selectedTx.valor || 0));
    return Math.max(1, value * 0.01);
  }, [selectedTx]);

  const dateWindowDays = 3;

  // 1. Initial Load: Accounts & Categories
  useEffect(() => {
    const init = async () => {
      if (!effectiveClinic) {
        setAccounts([]);
        setSelectedAccountId('');
        setCategories([]);
        return;
      }
      let accQuery = supabase.from('bank_accounts').select('*');
      if (effectiveClinic) accQuery = accQuery.eq('clinic_id', effectiveClinic);
      const { data: accs } = await accQuery;
      const { data: cats } = await supabase.from('categories').select('*');
      if (accs) setAccounts(accs as any);
      if (cats) setCategories(cats as any);
    };
    init();
  }, [effectiveClinic]);

  useEffect(() => {
    if (!selectedAccountId) return;
    if (!accounts.some((acc: any) => acc.id === selectedAccountId)) {
      setSelectedAccountId('');
    }
  }, [accounts, selectedAccountId]);

  // 2. Fetch Bank Transactions from DB when account changes
  useEffect(() => {
    if (selectedAccountId) fetchBankTransactions();
  }, [selectedAccountId]);


  const fetchBankTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', selectedAccountId)
        .order('data', { ascending: false });

      if (error) throw error;
    setBankTransactions(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const archiveTransaction = async (tx: any) => {
    if (!tx?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ arquivado: true })
        .eq('id', tx.id);
      if (error) throw error;
      fetchBankTransactions();
    } catch (err: any) {
      alert('Erro ao arquivar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const unarchiveTransaction = async (tx: any) => {
    if (!tx?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ arquivado: false })
        .eq('id', tx.id);
      if (error) throw error;
      fetchBankTransactions();
    } catch (err: any) {
      alert('Erro ao desarquivar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredBankTransactions = useMemo(() => {
    let list = bankTransactions;
    if (archivedHidden) {
      list = list.filter((t) => !t.arquivado);
    }
    if (showOnlyPending) {
      list = list.filter((t) => !t.conciliado);
    }
    if (showOnlyConciliated) {
      list = list.filter((t) => !!t.conciliado);
    }
    return list;
  }, [bankTransactions, archivedHidden, showOnlyPending, showOnlyConciliated]);

  const toISODate = (value: string) => {
    if (!value) return '';
    if (value.includes('T')) return value.split('T')[0];
    return value;
  };

  const addDays = (value: string, days: number) => {
    if (!value) return '';
    const base = new Date(`${value}T00:00:00`);
    if (Number.isNaN(base.getTime())) return value;
    base.setDate(base.getDate() + days);
    return base.toISOString().split('T')[0];
  };

  const dateDiffDays = (a: string, b: string) => {
    if (!a || !b) return 9999;
    const da = new Date(`${a}T00:00:00`);
    const db = new Date(`${b}T00:00:00`);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 9999;
    const diff = Math.abs(da.getTime() - db.getTime());
    return Math.round(diff / 86400000);
  };

  const toCents = (value: number) => Math.round(Number(value || 0) * 100);

  const fetchMatchCandidates = async (tx: any) => {
    if (!tx || !selectedAccountId) return;
    setLoadingMatches(true);
    try {
      const isIncome = tx.tipo === 'CREDIT';
      const amount = Math.abs(Number(tx.valor || 0));
      const date = toISODate(tx.data);
      const dateStart = addDays(date, -dateWindowDays);
      const dateEnd = addDays(date, dateWindowDays);

      let query = supabase
        .from(isIncome ? 'revenues' : 'expenses')
        .select('*')
        .eq('bank_account_id', selectedAccountId)
        .gte('data_competencia', dateStart)
        .lte('data_competencia', dateEnd);

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter((item: any) => {
        const val = isIncome
          ? Number(item.valor_bruto ?? item.valor_liquido ?? item.valor ?? 0)
          : Number(item.valor ?? 0);
        return Math.abs(val - amount) <= amountTolerance;
      });
      const ranked = filtered
        .map((item: any) => {
          const val = isIncome
            ? Number(item.valor_bruto ?? item.valor_liquido ?? item.valor ?? 0)
            : Number(item.valor ?? 0);
          const itemDate = toISODate(item.data_competencia || '');
          const sameDay = itemDate === date;
          const exactAmount = toCents(val) === toCents(amount);
          const dayDiff = dateDiffDays(itemDate, date);
          const amountDiff = Math.abs(val - amount);
          return { item, sameDay, exactAmount, dayDiff, amountDiff };
        })
        .sort((a, b) => {
          if (a.sameDay !== b.sameDay) return a.sameDay ? -1 : 1;
          if (a.exactAmount !== b.exactAmount) return a.exactAmount ? -1 : 1;
          if (a.dayDiff !== b.dayDiff) return a.dayDiff - b.dayDiff;
          return a.amountDiff - b.amountDiff;
        })
        .map((entry) => entry.item);
      setCandidateMatches(ranked);
    } catch (err) {
      console.error(err);
      setCandidateMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const openLinkModal = (tx: any) => {
    setSelectedTx(tx);
    setLinkQuery('');
    setCandidateMatches([]);
    setIsLinkModalOpen(true);
    fetchMatchCandidates(tx);
  };

  const handleLinkExisting = async (candidate: any) => {
    if (!selectedTx) return;
    setLoading(true);
    try {
      const isIncome = selectedTx.tipo === 'CREDIT';
      const updatePayload: any = { conciliado: true };
      if (isIncome) updatePayload.revenue_id_opcional = candidate.id;
      else updatePayload.expense_id_opcional = candidate.id;

      const { error } = await supabase
        .from('bank_transactions')
        .update(updatePayload)
        .eq('id', selectedTx.id);
      if (error) throw error;

      setIsLinkModalOpen(false);
      setSelectedTx(null);
      fetchBankTransactions();
    } catch (err: any) {
      alert('Erro ao vincular: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (tx: any) => {
    if (!tx?.id) return;
    setReopenLoading(true);
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ conciliado: false, revenue_id_opcional: null, expense_id_opcional: null })
        .eq('id', tx.id);
      if (error) throw error;
      setReopenTarget(null);
      fetchBankTransactions();
    } catch (err: any) {
      alert('Erro ao reabrir conciliação: ' + err.message);
    } finally {
      setReopenLoading(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    if (!linkQuery.trim()) return candidateMatches;
    const q = linkQuery.trim().toLowerCase();
    return candidateMatches.filter((item: any) => {
      const text = (item.description || item.paciente || item.fornecedor || '').toLowerCase();
      return text.includes(q);
    });
  }, [candidateMatches, linkQuery]);

  // 3. Handle File Upload & Save to DB
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAccountId) {
      alert("Selecione uma conta bancária antes de importar o arquivo.");
      return;
    }

    const file = event.target.files?.[0];
    if (file) {
      setLoading(true);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const parsed = parseOFX(text);
          let addedCount = 0;
          let dupCount = 0;

          // Process each transaction
          for (const tx of parsed) {
            // Check existence by hash
            const { data: existing } = await supabase
              .from('bank_transactions')
              .select('id')
              .eq('hash_transacao', tx.hash)
              .eq('bank_account_id', selectedAccountId) // Hash should be unique per account ideally
              .maybeSingle();

            if (!existing) {
              await supabase.from('bank_transactions').insert([{
                bank_account_id: selectedAccountId,
                data: tx.date,
                descricao: tx.description,
                valor: tx.amount,
                tipo: tx.type,
                hash_transacao: tx.hash,
                conciliado: false
              }]);
              addedCount++;
            } else {
              dupCount++;
            }
          }

          alert(`Processamento concluído: ${addedCount} novos, ${dupCount} duplicados ignorados.`);
          fetchBankTransactions();
        }
        setLoading(false);
      };
      reader.readAsText(file);
    }
  };

  // 4. Open "Create" Modal
  const openCreateModal = (tx: any) => {
    setSelectedTx(tx);
    setCreateForm({
      category_id: '',
      description: tx.descricao, // Suggest bank description
      entity_name: ''
    });
    setIsCreateModalOpen(true);
  };

  // 5. Handle "Create" Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || !createForm.category_id) return;

    setLoading(true);
    try {
      const isIncome = selectedTx.tipo === 'CREDIT';
      const table = isIncome ? 'revenues' : 'expenses';
      const amount = Math.abs(selectedTx.valor);

      // A. Create Revenue/Expense
      const payload: any = {
        description: createForm.description,
        data_competencia: selectedTx.data,
        category_id: createForm.category_id,
        bank_account_id: selectedAccountId,
        observacoes: 'Conciliado via OFX'
      };

      if (isIncome) {
        payload.valor_bruto = amount;
        payload.valor_liquido = amount; // Assume net for reconciliation unless edited
        payload.data_recebimento = selectedTx.data;
        payload.forma_pagamento = 'Transferência'; // Default for bank tx
        payload.paciente = createForm.entity_name;
      } else {
        payload.valor = amount;
        payload.data_pagamento = selectedTx.data;
        payload.fornecedor = createForm.entity_name;
        payload.tipo_despesa = 'Variavel';
      }

      const { data: newRecord, error } = await supabase
        .from(table)
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // B. Update Bank Transaction as Conciliated
      const updatePayload: any = {
        conciliado: true,
      };
      if (isIncome) updatePayload.revenue_id_opcional = newRecord.id;
      else updatePayload.expense_id_opcional = newRecord.id;

      await supabase
        .from('bank_transactions')
        .update(updatePayload)
        .eq('id', selectedTx.id);

      // C. Update Bank Account Balance? 
      // NOTE: If we are importing past transactions, usually we adjust balance manually or 
      // we assume the 'current_balance' in bank_accounts is the TRUE balance. 
      // For now, let's update it to keep consistent with manual entry logic.
      const account = accounts.find(a => a.id === selectedAccountId);
      if (account) {
        const currentBalance = Number((account as any).current_balance || 0);
        const newBal = currentBalance + selectedTx.valor; // OFX amount has sign
        await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', selectedAccountId);
      }

      setIsCreateModalOpen(false);
      fetchBankTransactions();

    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Conciliação Bancária</h1>
        <p className="text-gray-500">Importe extratos OFX e concilie lançamentos</p>
      </div>

      {/* Account Selection */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a Conta para Conciliar</label>
        <select
          className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {(acc as any).nome_conta || acc.name || 'Conta'} ({(acc as any).banco || acc.bank || 'Banco'})
            </option>
          ))}
        </select>
      </div>

      {selectedAccountId && (
        <>
          {/* Upload Area */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center border-dashed border-2 border-brand-100">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                {loading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800">Importar arquivo OFX</h3>
                <p className="text-gray-500 text-sm mt-1">Os lançamentos serão salvos e verificados contra duplicidade.</p>
              </div>
              <input
                type="file"
                accept=".ofx"
                id="ofx-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={loading}
              />
              <label
                htmlFor="ofx-upload"
                className={`px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 cursor-pointer transition-colors ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                Selecionar Arquivo
              </label>
              {fileName && (
                <p className="text-xs text-gray-500">Selecionado: {fileName}</p>
              )}
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="font-semibold text-gray-700">Lançamentos Bancários</h3>
                <span className="text-xs text-gray-400">Ordenado por data (mais recente)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-2 text-gray-600">
                  <input
                    type="checkbox"
                    checked={showOnlyPending}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowOnlyPending(checked);
                      if (checked) setShowOnlyConciliated(false);
                    }}
                  />
                  Mostrar apenas pendentes
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input
                    type="checkbox"
                    checked={showOnlyConciliated}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowOnlyConciliated(checked);
                      if (checked) setShowOnlyPending(false);
                    }}
                  />
                  Mostrar apenas conciliadas
                </label>
                <button
                  type="button"
                  onClick={() => setArchivedHidden((prev) => !prev)}
                  className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
                >
                  {archivedHidden ? (
                    <span className="inline-flex items-center gap-1"><Eye size={12} /> Mostrar arquivados</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><EyeOff size={12} /> Ocultar arquivados</span>
                  )}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Descrição Banco</th>
                    <th className="px-6 py-3">Valor</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBankTransactions.map((t) => {
                    const isCredit = t.tipo === 'CREDIT';

                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-600">{formatDate(t.data)}</td>
                        <td className="px-6 py-4 font-medium text-gray-800">{t.descricao}</td>
                        <td className={`px-6 py-4 font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(t.valor)}
                        </td>
                        <td className="px-6 py-4">
                          {t.conciliado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <CheckCircle size={12} /> Conciliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                              <AlertCircle size={12} /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!t.conciliado && (
                              <>
                                <button
                                  className="flex items-center gap-1 px-3 py-1 text-xs border border-brand-200 text-brand-700 bg-brand-50 rounded hover:bg-brand-100 transition-colors"
                                  title="Vincular a lançamento já existente"
                                  onClick={() => openLinkModal(t)}
                                >
                                  <LinkIcon size={12} /> Vincular
                                </button>
                                <button
                                  onClick={() => openCreateModal(t)}
                                  className="flex items-center gap-1 px-3 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors"
                                  title="Criar receita/despesa a partir deste item"
                                >
                                  <PlusCircle size={12} /> Criar
                                </button>
                              </>
                            )}
                            {t.conciliado && (
                              <button
                                onClick={() => setReopenTarget(t)}
                                className="flex items-center gap-1 px-3 py-1 text-xs border border-yellow-200 text-yellow-700 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                                title="Reabrir conciliação"
                              >
                                Reabrir
                              </button>
                            )}
                            {!t.arquivado ? (
                              <button
                                onClick={() => archiveTransaction(t)}
                                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                                title="Arquivar"
                              >
                                <EyeOff size={12} /> Arquivar
                              </button>
                            ) : (
                              <button
                                onClick={() => unarchiveTransaction(t)}
                                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                                title="Desarquivar"
                              >
                                <Eye size={12} /> Desarquivar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBankTransactions.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum lançamento importado nesta conta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Criar Lançamento da Conciliação */}
      {isCreateModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              Nova {selectedTx.tipo === 'CREDIT' ? 'Receita' : 'Despesa'} (Conciliação)
            </h2>
            <div className="mb-4 text-sm text-gray-500 flex gap-2">
              <span>{formatDate(selectedTx.data)}</span>
              <span>•</span>
              <span className={selectedTx.tipo === 'CREDIT' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {formatCurrency(selectedTx.valor)}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  required
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  required
                  value={createForm.category_id}
                  onChange={e => setCreateForm({ ...createForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {categories
                    .filter(c => (c as any).tipo === (selectedTx.tipo === 'CREDIT' ? 'receita' : 'despesa'))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedTx.tipo === 'CREDIT' ? 'Paciente / Pagador' : 'Fornecedor'}
                </label>
                <input
                  value={createForm.entity_name}
                  onChange={e => setCreateForm({ ...createForm, entity_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Confirmar e Conciliar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vincular Lançamento Existente */}
      {isLinkModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Vincular lançamento existente</h2>
                <p className="text-sm text-gray-500">
                  Procuramos lançamentos com data próxima (±{dateWindowDays} dias) e valor aproximado (±{formatCurrency(amountTolerance)}).
                </p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>{formatDate(selectedTx.data)}</div>
                <div className={selectedTx.tipo === 'CREDIT' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {formatCurrency(selectedTx.valor)}
                </div>
              </div>
            </div>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="Filtrar por descrição/paciente/fornecedor..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="max-h-80 overflow-auto border border-gray-100 rounded-lg">
              {loadingMatches ? (
                <div className="p-6 text-center text-gray-400">
                  <Loader2 size={20} className="animate-spin inline-block mr-2" />
                  Buscando lançamentos...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  Nenhum lançamento encontrado com esse critério.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Descrição</th>
                      <th className="px-4 py-2 text-left">Valor</th>
                      <th className="px-4 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCandidates.map((item: any) => {
                      const isIncome = selectedTx.tipo === 'CREDIT';
                      const value = isIncome
                        ? Number(item.valor_bruto ?? item.valor_liquido ?? item.valor ?? 0)
                        : Number(item.valor ?? 0);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-gray-600">{formatDate(item.data_competencia)}</td>
                          <td className="px-4 py-2 text-gray-800">
                            {item.description || item.paciente || item.fornecedor || '-'}
                          </td>
                          <td className={`px-4 py-2 ${selectedTx.tipo === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(value)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleLinkExisting(item)}
                              className="px-3 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700"
                              disabled={loading}
                            >
                              Vincular
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reabrir Conciliação */}
      {reopenTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Reabrir conciliação?</h2>
            <p className="text-sm text-gray-600">
              Isso remove o vínculo com o lançamento e marca o item como pendente.
            </p>
            <div className="mt-4 text-sm text-gray-700 space-y-1">
              <div><span className="font-medium">Data:</span> {formatDate(reopenTarget.data)}</div>
              <div><span className="font-medium">Valor:</span> {formatCurrency(reopenTarget.valor)}</div>
              <div><span className="font-medium">Descrição:</span> {reopenTarget.descricao}</div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReopenTarget(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={reopenLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleUnlink(reopenTarget)}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                disabled={reopenLoading}
              >
                {reopenLoading ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
