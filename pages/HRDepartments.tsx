import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';

const MultiSelect: React.FC<{
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder = 'Selecione' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.filter((opt) => value.includes(opt.value));

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white focus:ring-brand-500 outline-none"
      >
        {selected.length === 0 && <span className="text-gray-400">{placeholder}</span>}
        {selected.length > 0 && (
          <span className="text-gray-700">
            {selected.slice(0, 2).map((opt) => opt.label).join(', ')}
            {selected.length > 2 ? ` +${selected.length - 2}` : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...value, opt.value]);
                    else onChange(value.filter((id) => id !== opt.value));
                  }}
                />
                <span className="text-gray-700">{opt.label}</span>
              </label>
            );
          })}
          {options.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Nenhum departamento disponível.</p>}
        </div>
      )}
    </div>
  );
};

const HRDepartments: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', affiliates: [] as string[] });

  const normalizeDepartmentName = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const loadDepartments = async () => {
    if (!clinicId) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('hr_departments')
      .select(
        `
        id,
        name,
        created_at,
        affiliates:hr_department_affiliations!hr_department_affiliations_department_id_fkey (
          affiliated_department_id,
          affiliated:hr_departments!hr_department_affiliations_affiliated_department_id_fkey (id, name)
        )
      `
      )
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setDepartments(data as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDepartments();
  }, [clinicId]);

  const departmentOptions = useMemo(
    () =>
      departments.map((dep) => ({
        value: dep.id,
        label: dep.name,
      })),
    [departments]
  );

  const filteredDepartments = useMemo(() => {
    if (!search.trim()) return departments;
    const needle = search.toLowerCase();
    return departments.filter((dep) => dep.name.toLowerCase().includes(needle));
  }, [departments, search]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setForm({ name: '', affiliates: [] });
    setShowModal(true);
  };

  const openEditModal = (dep: any) => {
    setEditingId(dep.id);
    setFormError(null);
    const affiliateIds = (dep.affiliates || []).map((aff: any) => aff.affiliated_department_id);
    setForm({ name: dep.name || '', affiliates: affiliateIds });
    setShowModal(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicId) {
      setFormError('Nenhuma clínica ativa para salvar o departamento.');
      return;
    }
    const normalizedName = form.name.trim();
    const normalizedKey = normalizeDepartmentName(normalizedName);
    if (!normalizedName) {
      setFormError('Informe o nome do departamento.');
      return;
    }
    const duplicate = departments.find(
      (dep) =>
        dep.id !== editingId && normalizeDepartmentName(dep.name || '') === normalizedKey
    );
    if (duplicate) {
      setFormError('Já existe um departamento com esse nome.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      let departmentId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from('hr_departments')
          .update({ name: normalizedName, name_normalized: normalizedKey })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('hr_departments')
          .insert({ clinic_id: clinicId, name: normalizedName, name_normalized: normalizedKey })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        departmentId = data?.id || null;
      }

      if (departmentId) {
        await supabase.from('hr_department_affiliations').delete().eq('department_id', departmentId);
        const uniqueAffiliates = Array.from(new Set(form.affiliates.filter((id) => id !== departmentId)));
        if (uniqueAffiliates.length) {
          const rows = uniqueAffiliates.map((id) => ({
            department_id: departmentId,
            affiliated_department_id: id,
          }));
          const { error } = await supabase.from('hr_department_affiliations').insert(rows);
          if (error) throw error;
        }
      }

      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', affiliates: [] });
      loadDepartments();
    } catch (err: any) {
      if (err?.code === '23505') {
        setFormError('Já existe um departamento com esse nome.');
      } else {
        setFormError(err?.message || 'Erro ao salvar departamento.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600 font-semibold">Recursos Humanos</p>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
          <p className="text-sm text-gray-500">Cadastre e organize os departamentos da clínica.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} /> Novo departamento
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por departamento"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={16} />
          {filteredDepartments.length} registros
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Lista de departamentos</p>
          <span className="text-xs text-gray-400">Organize por equipe e área</span>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Carregando departamentos...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDepartments.map((dep, idx) => (
              <div key={dep.id} className="px-6 py-4 flex flex-wrap items-center gap-4 hover:bg-gray-50">
                <div className="w-10 text-sm text-gray-400">#{String(idx + 1).padStart(2, '0')}</div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-gray-900">{dep.name}</p>
                  <p className="text-xs text-gray-500">Criado em {formatDate(dep.created_at || '')}</p>
                </div>
                <div className="min-w-[240px]">
                  <p className="text-xs text-gray-400 mb-1">Departamentos afiliados</p>
                  <div className="flex flex-wrap gap-2">
                    {(dep.affiliates || []).map((aff: any) => (
                      <span key={aff.affiliated_department_id} className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                        {aff.affiliated?.name || 'Departamento'}
                      </span>
                    ))}
                    {(dep.affiliates || []).length === 0 && (
                      <span className="text-xs text-gray-400">Sem afiliados.</span>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(dep)}
                    className="px-3 py-1 text-xs rounded-full border border-brand-100 text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Excluir departamento?')) return;
                      const { error } = await supabase.from('hr_departments').delete().eq('id', dep.id);
                      if (!error) loadDepartments();
                    }}
                    className="px-3 py-1 text-xs rounded-full border border-rose-100 text-rose-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {filteredDepartments.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Nenhum departamento cadastrado.</div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar departamento' : 'Novo departamento'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  placeholder="Nome do departamento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departamentos afiliados</label>
                <MultiSelect
                  options={departmentOptions.filter((opt) => opt.value !== editingId)}
                  value={form.affiliates}
                  onChange={(next) => setForm((prev) => ({ ...prev, affiliates: next }))}
                  placeholder="Selecione"
                />
              </div>
              {formError && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{formError}</div>}
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
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRDepartments;
