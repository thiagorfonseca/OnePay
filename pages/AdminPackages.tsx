import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, X, Package as PackageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PackageForm = {
  name: string;
  description: string;
  pages: string[];
  courseIds: string[];
  trainingIds: string[];
};

const PAGE_OPTIONS = [
  { value: '/', label: 'Dashboard' },
  { value: '/incomes', label: 'Receitas' },
  { value: '/expenses', label: 'Despesas' },
  { value: '/card-analysis', label: 'Análise de cartão' },
  { value: '/reconciliation', label: 'Conciliação bancária' },
  { value: '/profile', label: 'Meu perfil' },
  { value: '/assistant', label: 'Assistente IA' },
  { value: '/contents/courses', label: 'Conteúdos • Cursos' },
  { value: '/contents/trainings', label: 'Conteúdos • Treinamentos' },
  { value: '/accounts', label: 'Contas bancárias' },
  { value: '/settings', label: 'Configurações' },
  { value: '/settings?section=categorias', label: 'Configurações • Categorias' },
  { value: '/settings?section=taxas', label: 'Configurações • Taxas' },
  { value: '/settings?section=clientes', label: 'Configurações • Clientes' },
  { value: '/settings?section=procedimentos', label: 'Configurações • Procedimentos' },
  { value: '/settings?section=profissionais', label: 'Configurações • Profissionais' },
  { value: '/settings?section=fornecedores', label: 'Configurações • Fornecedores' },
  { value: '/settings?section=usuarios', label: 'Configurações • Usuários' },
  { value: '/commercial/dashboard', label: 'Comercial • Dashboard' },
  { value: '/commercial/ranking', label: 'Comercial • Ranking dos clientes' },
  { value: '/commercial/recurrence', label: 'Comercial • Recorrência' },
  { value: '/commercial/geo', label: 'Comercial • Geolocalização' },
  { value: '/pricing/calculator', label: 'Precificação • Calculadora' },
  { value: '/pricing/procedures', label: 'Precificação • Procedimentos' },
  { value: '/pricing/expenses', label: 'Precificação • Gastos' },
  { value: '/pricing/focus-matrix', label: 'Precificação • Matriz de Foco' },
  { value: '/hr/departments', label: 'Recursos Humanos • Departamentos' },
  { value: '/hr/collaborators', label: 'Recursos Humanos • Colaboradores' },
  { value: '/hr/feedback', label: 'Recursos Humanos • Feedback' },
  { value: '/hr/meetings', label: 'Recursos Humanos • Reuniões' },
  { value: '/hr/archetypes', label: 'Recursos Humanos • Arquétipos' },
  { value: '/hr/values', label: 'Recursos Humanos • Teoria de valores' },
];

const emptyForm: PackageForm = {
  name: '',
  description: '',
  pages: [],
  courseIds: [],
  trainingIds: [],
};

const AdminPackages: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [packageCounts, setPackageCounts] = useState<Record<string, { courses: number; trainings: number }>>({});
  const [courses, setCourses] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [clinicPackageId, setClinicPackageId] = useState('');
  const [savingClinicPackages, setSavingClinicPackages] = useState(false);

  const pageLabelMap = useMemo(() => Object.fromEntries(PAGE_OPTIONS.map((p) => [p.value, p.label])), []);

  const loadPackages = async () => {
    const { data, error: loadError } = await (supabase as any)
      .from('content_packages')
      .select('*')
      .order('created_at', { ascending: false });
    if (loadError) throw loadError;
    setPackages((data || []) as any[]);
  };

  const loadPackageCounts = async (ids: string[]) => {
    if (!ids.length) {
      setPackageCounts({});
      return;
    }
    const { data, error } = await (supabase as any)
      .from('content_package_items')
      .select('package_id, content_items (id, type)')
      .in('package_id', ids);
    if (error) throw error;
    const counts: Record<string, { courses: number; trainings: number }> = {};
    (data || []).forEach((row: any) => {
      const pkgId = row.package_id as string;
      const item = row.content_items;
      if (!pkgId || !item) return;
      if (!counts[pkgId]) counts[pkgId] = { courses: 0, trainings: 0 };
      if (item.type === 'course') counts[pkgId].courses += 1;
      if (item.type === 'training') counts[pkgId].trainings += 1;
    });
    setPackageCounts(counts);
  };

  const loadContents = async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('id, title, type, published')
      .order('title', { ascending: true });
    if (error) throw error;
    const items = (data || []) as any[];
    setCourses(items.filter((item) => item.type === 'course'));
    setTrainings(items.filter((item) => item.type === 'training'));
  };

  const loadClinics = async () => {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) throw error;
    setClinics((data || []) as any[]);
  };

  const loadClinicPackages = async (clinicId: string) => {
    if (!clinicId) {
      setClinicPackageId('');
      return;
    }
    const { data, error } = await (supabase as any)
      .from('clinic_packages')
      .select('package_id')
      .eq('clinic_id', clinicId);
    if (error) throw error;
    const pkgId = (data || []).map((row: any) => row.package_id).filter(Boolean)[0] || '';
    setClinicPackageId(pkgId);
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPackages(), loadContents(), loadClinics()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pacotes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const ids = packages.map((pkg) => pkg.id).filter(Boolean);
    loadPackageCounts(ids).catch(() => setPackageCounts({}));
  }, [packages]);

  useEffect(() => {
    if (!selectedClinicId) return;
    loadClinicPackages(selectedClinicId).catch(() => setClinicPackageId(''));
  }, [selectedClinicId]);

  const handleOpenNew = () => {
    setEditingPackageId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleEditPackage = async (pkg: any) => {
    setEditingPackageId(pkg.id);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      pages: pkg.pages || [],
      courseIds: [],
      trainingIds: [],
    });
    setShowModal(true);
    try {
      const { data, error } = await (supabase as any)
        .from('content_package_items')
        .select('content_items (id, type)')
        .eq('package_id', pkg.id);
      if (error) throw error;
      const courseIds: string[] = [];
      const trainingIds: string[] = [];
      (data || []).forEach((row: any) => {
        const item = row.content_items;
        if (!item) return;
        if (item.type === 'course') courseIds.push(item.id);
        if (item.type === 'training') trainingIds.push(item.id);
      });
      setForm((prev) => ({ ...prev, courseIds, trainingIds }));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar itens do pacote.');
    }
  };

  const handleSavePackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome do pacote.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        pages: form.pages,
      };
      let packageId = editingPackageId;
      if (editingPackageId) {
        const { error: updateError } = await (supabase as any)
          .from('content_packages')
          .update(payload)
          .eq('id', editingPackageId);
        if (updateError) throw updateError;
      } else {
        const { data: created, error: insertError } = await (supabase as any)
          .from('content_packages')
          .insert([payload])
          .select()
          .single();
        if (insertError) throw insertError;
        packageId = created?.id;
      }

      if (packageId) {
        await (supabase as any).from('content_package_items').delete().eq('package_id', packageId);
        const contentIds = Array.from(new Set([...form.courseIds, ...form.trainingIds]));
        if (contentIds.length) {
          const rows = contentIds.map((contentId) => ({ package_id: packageId, content_id: contentId }));
          const { error: itemError } = await (supabase as any).from('content_package_items').insert(rows);
          if (itemError) throw itemError;
        }
      }

      setShowModal(false);
      setEditingPackageId(null);
      setForm(emptyForm);
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar pacote.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = async (pkg: any) => {
    if (!confirm(`Excluir o pacote "${pkg.name}"?`)) return;
    const { error: deleteError } = await (supabase as any)
      .from('content_packages')
      .delete()
      .eq('id', pkg.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadPackages();
  };

  const handleSaveClinicPackages = async () => {
    if (!selectedClinicId) return;
    setSavingClinicPackages(true);
    try {
      await (supabase as any).from('clinic_packages').delete().eq('clinic_id', selectedClinicId);
      if (clinicPackageId) {
        const { error } = await (supabase as any).from('clinic_packages').insert([
          { clinic_id: selectedClinicId, package_id: clinicPackageId },
        ]);
        if (error) throw error;
      }
      alert('Pacotes atualizados para a clínica.');
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar pacotes da clínica.');
    } finally {
      setSavingClinicPackages(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pacotes</h1>
          <p className="text-gray-500">Defina cursos, treinamentos e páginas para cada pacote.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenNew}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Adicionar pacote
        </button>
      </div>

      {error && (
        <div className="bg-white border border-red-100 rounded-xl p-4 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <PackageIcon size={16} /> Atribuir pacotes à clínica
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
            >
              <option value="">Selecione...</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pacotes liberados</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                <input
                  type="radio"
                  name="clinicPackage"
                  checked={!clinicPackageId}
                  onChange={() => setClinicPackageId('')}
                />
                Sem pacote
              </label>
              {packages.map((pkg) => {
                const checked = clinicPackageId === pkg.id;
                return (
                  <label key={pkg.id} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                    <input
                      type="radio"
                      name="clinicPackage"
                      checked={checked}
                      onChange={() => setClinicPackageId(pkg.id)}
                    />
                    {pkg.name}
                  </label>
                );
              })}
              {packages.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum pacote cadastrado.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
          disabled={!selectedClinicId || savingClinicPackages}
          onClick={handleSaveClinicPackages}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {savingClinicPackages ? 'Salvando...' : 'Salvar pacotes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading && (
          <div className="text-sm text-gray-400">Carregando pacotes...</div>
        )}
        {!loading && packages.length === 0 && (
          <div className="text-sm text-gray-400">Nenhum pacote cadastrado.</div>
        )}
        {!loading && packages.map((pkg) => {
          const counts = packageCounts[pkg.id] || { courses: 0, trainings: 0 };
          return (
            <div key={pkg.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{pkg.name}</h3>
                  {pkg.description && <p className="text-sm text-gray-500">{pkg.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEditPackage(pkg)} className="text-sm text-brand-600">Editar</button>
                  <button onClick={() => handleDeletePackage(pkg)} className="text-sm text-red-600">Excluir</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="px-2 py-1 rounded-full bg-slate-100">Cursos: {counts.courses}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100">Treinamentos: {counts.trainings}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100">Páginas: {pkg.pages?.length || 0}</span>
              </div>
              {pkg.pages?.length > 0 && (
                <p className="text-xs text-gray-500">
                  {pkg.pages.map((p: string) => pageLabelMap[p] || p).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">
                {editingPackageId ? 'Editar pacote' : 'Novo pacote'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSavePackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cursos inclusos</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border border-gray-100 rounded-lg p-2">
                  {courses.map((course) => {
                    const checked = form.courseIds.includes(course.id);
                    return (
                      <label key={course.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm((prev) => ({ ...prev, courseIds: [...prev.courseIds, course.id] }));
                            } else {
                              setForm((prev) => ({ ...prev, courseIds: prev.courseIds.filter((id) => id !== course.id) }));
                            }
                          }}
                        />
                        {course.title || 'Sem título'}
                      </label>
                    );
                  })}
                  {courses.length === 0 && <p className="text-sm text-gray-400">Nenhum curso cadastrado.</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treinamentos inclusos</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border border-gray-100 rounded-lg p-2">
                  {trainings.map((training) => {
                    const checked = form.trainingIds.includes(training.id);
                    return (
                      <label key={training.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm((prev) => ({ ...prev, trainingIds: [...prev.trainingIds, training.id] }));
                            } else {
                              setForm((prev) => ({ ...prev, trainingIds: prev.trainingIds.filter((id) => id !== training.id) }));
                            }
                          }}
                        />
                        {training.title || 'Sem título'}
                      </label>
                    );
                  })}
                  {trainings.length === 0 && <p className="text-sm text-gray-400">Nenhum treinamento cadastrado.</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Páginas inclusas</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, pages: PAGE_OPTIONS.map((p) => p.value) }))}
                    className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                  >
                    Selecionar tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, pages: [] }))}
                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100"
                  >
                    Limpar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border border-gray-100 rounded-lg p-2">
                  {PAGE_OPTIONS.map((page) => {
                    const checked = form.pages.includes(page.value);
                    return (
                      <label key={page.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm((prev) => ({ ...prev, pages: [...prev.pages, page.value] }));
                            } else {
                              setForm((prev) => ({ ...prev, pages: prev.pages.filter((p) => p !== page.value) }));
                            }
                          }}
                        />
                        {page.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {editingPackageId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPackages;
