import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Download, Loader2, Plus, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

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

const PricingProcedures: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [procedures, setProcedures] = useState<any[]>([]);
  const [procedureForm, setProcedureForm] = useState({
    categoria: '',
    procedimento: '',
    valor_cobrado: '',
    custo_insumo: '',
    tempo_minutos: '',
  });
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [savingProcedure, setSavingProcedure] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [procedureSearch, setProcedureSearch] = useState('');

  const fetchProcedures = async () => {
    let query = supabase.from('procedures').select('*').order('created_at', { ascending: false });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setProcedures(data as any[]);
  };

  useEffect(() => {
    fetchProcedures();
  }, [clinicId]);

  const filteredProcedures = useMemo(() => {
    if (!procedureSearch.trim()) return procedures;
    const needle = procedureSearch.toLowerCase();
    return procedures.filter((p) => (p.procedimento || '').toLowerCase().includes(needle));
  }, [procedures, procedureSearch]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Procedimentos</h1>
        <p className="text-gray-500">Precificação • Procedimentos</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CheckSquare size={16} /> Procedimentos realizados
            </h2>
            <p className="text-sm text-gray-500">Cadastre procedimentos individualmente ou importe via CSV.</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('#,Categoria,Procedimento,Custo insumo,Tempo (min),Valor cobrado\n1,Consulta,Consulta Geral,50,30,200')}`}
              download="modelo_procedimentos.csv"
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
                    alert('Nenhuma clínica ativa para importar procedimentos.');
                    return;
                  }
                  const file = e.target.files[0];
                  setUploadingCsv(true);
                  try {
                    const text = (await file.text()).replace(/^\uFEFF/, '');
                    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
                    if (!lines.length) throw new Error('Arquivo vazio');

                    const first = lines[0];
                    const separator = detectCsvSeparator(first);
                    const parseLine = (line: string) => parseCsvLine(line, separator);

                    const header = parseLine(first).map((value) => value.toLowerCase());
                    const hasHeader = header.some((value) => value.includes('procedimento') || value.includes('categoria'));
                    const dataLines = hasHeader ? lines.slice(1) : lines;

                    const findIdx = (needle: string[]) => {
                      const idx = header.findIndex((h) => needle.some((n) => h.includes(n)));
                      return idx >= 0 ? idx : -1;
                    };
                    const idxCategoria = hasHeader ? findIdx(['categoria']) : -1;
                    const idxProcedimento = hasHeader ? findIdx(['procedimento']) : -1;
                    const idxCusto = hasHeader ? findIdx(['custo']) : -1;
                    const idxTempo = hasHeader ? findIdx(['tempo']) : -1;
                    const idxValor = hasHeader ? findIdx(['valor']) : -1;

                    const payload = dataLines
                      .map((row) => {
                        const cols = parseLine(row);
                        const shift = !hasHeader && cols.length >= 6 ? 1 : 0;

                        const valToNumber = (value?: string | null) => {
                          if (value === undefined || value === null || value === '') return null;
                          const normalized = value.replace(/\./g, '').replace(',', '.');
                          const num = Number(normalized);
                          return Number.isFinite(num) ? num : null;
                        };

                        const pick = (idxHeader: number, fallback: number) => {
                          const idx = idxHeader >= 0 ? idxHeader : fallback;
                          return cols[idx] ?? '';
                        };

                        const categoria = pick(idxCategoria, shift + 0);
                        const procedimento = pick(idxProcedimento, shift + 1);
                        const custo = pick(idxCusto, shift + 2);
                        const tempo = pick(idxTempo, shift + 3);
                        const valor = pick(idxValor, shift + 4);

                        return {
                          categoria: categoria || null,
                          procedimento: procedimento || '',
                          custo_insumo: valToNumber(custo),
                          tempo_minutos: valToNumber(tempo),
                          valor_cobrado: valToNumber(valor),
                          clinic_id: clinicId,
                        };
                      })
                      .filter((p) => p.procedimento);

                    if (payload.length) {
                      const { error } = await supabase.from('procedures').insert(payload);
                      if (error) throw error;
                      fetchProcedures();
                    } else {
                      alert('Nenhuma linha válida encontrada no CSV.');
                    }
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
        </div>

        <div className="flex flex-wrap gap-2 justify-between items-center">
          <input
            type="text"
            value={procedureSearch}
            onChange={(e) => setProcedureSearch(e.target.value)}
            placeholder="Buscar procedimento..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 flex-1 min-w-[220px]"
          />
          <button
            onClick={async () => {
              if (!selectedProcedures.length) return;
              if (!confirm('Apagar procedimentos selecionados?')) return;
              const { error } = await supabase.from('procedures').delete().in('id', selectedProcedures);
              if (!error) {
                setSelectedProcedures([]);
                fetchProcedures();
              }
            }}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm mr-2 disabled:opacity-50"
            disabled={!selectedProcedures.length}
          >
            Apagar selecionados
          </button>
          <button
            onClick={() => {
              setEditingProcedureId(null);
              setProcedureForm({
                categoria: '',
                procedimento: '',
                valor_cobrado: '',
                custo_insumo: '',
                tempo_minutos: '',
              });
              setShowProcedureModal(true);
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
          >
            <Plus size={16} /> Novo procedimento
          </button>
        </div>

        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedProcedures.length > 0 && selectedProcedures.length === procedures.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedProcedures(procedures.map((p) => p.id));
                      else setSelectedProcedures([]);
                    }}
                  />
                </th>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Categoria</th>
                <th className="px-4 py-2 text-left">Procedimento</th>
                <th className="px-4 py-2 text-left">Custo insumo</th>
                <th className="px-4 py-2 text-left">Tempo (min)</th>
                <th className="px-4 py-2 text-left">Valor cobrado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProcedures.map((p, idx) => {
                const selected = selectedProcedures.includes(p.id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProcedures((prev) => [...prev, p.id]);
                          else setSelectedProcedures((prev) => prev.filter((id) => id !== p.id));
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-2 text-gray-700">{p.categoria || '-'}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{p.procedimento}</td>
                    <td className="px-4 py-2 text-gray-700">{p.custo_insumo ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700">{p.tempo_minutos ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700">{p.valor_cobrado ?? '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditingProcedureId(p.id);
                          setProcedureForm({
                            categoria: p.categoria || '',
                            procedimento: p.procedimento || '',
                            valor_cobrado: p.valor_cobrado || '',
                            custo_insumo: p.custo_insumo || '',
                            tempo_minutos: p.tempo_minutos || '',
                          });
                          setShowProcedureModal(true);
                        }}
                        className="text-brand-600 text-sm mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Excluir procedimento?')) return;
                          const { error } = await supabase.from('procedures').delete().eq('id', p.id);
                          if (!error) fetchProcedures();
                        }}
                        className="text-red-600 text-sm"
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {procedures.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">
                    Nenhum procedimento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showProcedureModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-800">
                  {editingProcedureId ? 'Editar procedimento' : 'Novo procedimento'}
                </h4>
                <button
                  onClick={() => {
                    setShowProcedureModal(false);
                    setEditingProcedureId(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  if (!procedureForm.procedimento.trim()) return;
                  if (!clinicId) {
                    alert('Nenhuma clínica ativa para salvar procedimento.');
                    return;
                  }
                  setSavingProcedure(true);
                  try {
                    const payload = {
                      categoria: procedureForm.categoria || null,
                      procedimento: procedureForm.procedimento,
                      valor_cobrado: procedureForm.valor_cobrado ? Number(procedureForm.valor_cobrado) : null,
                      custo_insumo: procedureForm.custo_insumo ? Number(procedureForm.custo_insumo) : null,
                      tempo_minutos: procedureForm.tempo_minutos ? Number(procedureForm.tempo_minutos) : null,
                      clinic_id: clinicId,
                    };
                    if (editingProcedureId) {
                      const { error } = await supabase.from('procedures').update(payload).eq('id', editingProcedureId);
                      if (error) throw error;
                    } else {
                      const { error } = await supabase.from('procedures').insert([payload]);
                      if (error) throw error;
                    }
                    setProcedureForm({
                      categoria: '',
                      procedimento: '',
                      valor_cobrado: '',
                      custo_insumo: '',
                      tempo_minutos: '',
                    });
                    setEditingProcedureId(null);
                    setShowProcedureModal(false);
                    fetchProcedures();
                  } catch (err: any) {
                    alert('Erro ao salvar procedimento: ' + err.message);
                  } finally {
                    setSavingProcedure(false);
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <input
                    value={procedureForm.categoria}
                    onChange={(e) => setProcedureForm({ ...procedureForm, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    placeholder="Ex: Consulta"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
                  <input
                    required
                    value={procedureForm.procedimento}
                    onChange={(e) => setProcedureForm({ ...procedureForm, procedimento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    placeholder="Nome do procedimento"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor cobrado</label>
                  <input
                    type="number"
                    value={procedureForm.valor_cobrado}
                    onChange={(e) => setProcedureForm({ ...procedureForm, valor_cobrado: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo insumo</label>
                  <input
                    type="number"
                    value={procedureForm.custo_insumo}
                    onChange={(e) => setProcedureForm({ ...procedureForm, custo_insumo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tempo (min)</label>
                  <input
                    type="number"
                    value={procedureForm.tempo_minutos}
                    onChange={(e) => setProcedureForm({ ...procedureForm, tempo_minutos: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProcedureModal(false);
                      setEditingProcedureId(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingProcedure}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingProcedure ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {editingProcedureId ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingProcedures;
