import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildPublicUrl, formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';

const USER_AVATAR_BUCKET = 'user-avatars';
const MAX_AVATAR_DIMENSION = 350;

const PAGE_OPTIONS = [
  { value: '/', label: 'Dashboard' },
  { value: '/incomes', label: 'Receitas' },
  { value: '/expenses', label: 'Despesas' },
  { value: '/card-analysis', label: 'Análise de cartão' },
  { value: '/reconciliation', label: 'Conciliação bancária' },
  { value: '/assistant', label: 'Assistente IA' },
  { value: '/profile', label: 'Meu perfil' },
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

const CONTRACT_OPTIONS = ['CLT', 'PJ', 'MEI', 'Estágio', 'Temporário', 'Terceirizado', 'Outro'];

const toSafeFileName = (name: string) => {
  const withoutAccents = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = withoutAccents.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const trimmed = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return trimmed || `file-${crypto.randomUUID()}`;
};

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida.'));
    };
    img.src = url;
  });

const validateAvatarFile = async (file: File) => {
  if (!file.type.startsWith('image/')) return 'Envie um arquivo de imagem.';
  try {
    const { width, height } = await readImageDimensions(file);
    if (width !== height) return 'A imagem precisa ser quadrada.';
    if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
      return `A imagem deve ter no máximo ${MAX_AVATAR_DIMENSION} x ${MAX_AVATAR_DIMENSION}px.`;
    }
    return null;
  } catch {
    return 'Não foi possível ler a imagem.';
  }
};

const uploadClinicUserAvatar = async (clinicId: string, file: File) => {
  const safeName = toSafeFileName(file.name);
  const path = `clinics/${clinicId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(USER_AVATAR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const getInitials = (name: string, email: string) => {
  const cleaned = name.trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'CL';
};

const HRCollaborators: React.FC = () => {
  const { effectiveClinicId: clinicId, clinic, clinicUser } = useAuth();
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [detailCollaborator, setDetailCollaborator] = useState<any | null>(null);
  const pageMenuRef = useRef<HTMLDetailsElement | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    birthDate: '',
    admissionDate: '',
    role: 'user',
    pages: [] as string[],
    salary: '',
    functionTitle: '',
    jobTitle: '',
    contractType: '',
    jobDescription: '',
    archetype: '',
    avatarUrl: null as string | null,
  });

  const resetRedirectUrl = buildPublicUrl('/auth/reset');

  const clinicPages = useMemo(() => {
    return (clinic?.paginas_liberadas || []).map((page) => page.trim()).filter(Boolean);
  }, [clinic?.paginas_liberadas]);

  const availablePageOptions = useMemo(() => {
    if (!clinicPages.length) return PAGE_OPTIONS;
    const hasSettings = clinicPages.includes('/settings');
    return PAGE_OPTIONS.filter((option) => {
      if (option.value === '/settings?section=usuarios') {
        return hasSettings || clinicPages.includes(option.value);
      }
      return clinicPages.includes(option.value) || clinicPages.some((allowed) => option.value.startsWith(allowed));
    });
  }, [clinicPages]);

  const availablePageSet = useMemo(() => new Set(availablePageOptions.map((p) => p.value)), [availablePageOptions]);
  const pageLabelMap = useMemo(() => Object.fromEntries(PAGE_OPTIONS.map((p) => [p.value, p.label])), []);

  const filteredCollaborators = useMemo(() => {
    if (!search.trim()) return collaborators;
    const needle = search.toLowerCase();
    return collaborators.filter((c) =>
      [c.name, c.email, c.job_title, c.function_title].filter(Boolean).join(' ').toLowerCase().includes(needle)
    );
  }, [collaborators, search]);

  const loadCollaborators = async () => {
    if (!clinicId) {
      setCollaborators([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_users')
      .select(
        `
        id,
        clinic_id,
        name,
        email,
        role,
        paginas_liberadas,
        avatar_url,
        user_id,
        created_at,
        hr_collaborators (
          birth_date,
          admission_date,
          job_title,
          function_title,
          contract_type,
          salary,
          description,
          archetype
        )
      `
      )
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const merged = (data as any[]).map((row) => ({
        ...row,
        ...(row.hr_collaborators?.[0] || {}),
      }));
      setCollaborators(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCollaborators();
  }, [clinicId]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setForm({
      name: '',
      email: '',
      birthDate: '',
      admissionDate: '',
      role: 'user',
      pages: [],
      salary: '',
      functionTitle: '',
      jobTitle: '',
      contractType: '',
      jobDescription: '',
      archetype: '',
      avatarUrl: null,
    });
    setShowModal(true);
  };

  const openEditModal = (collab: any) => {
    setEditingId(collab.id);
    setFormError(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setForm({
      name: collab.name || '',
      email: collab.email || '',
      birthDate: collab.birth_date || '',
      admissionDate: collab.admission_date || '',
      role: collab.role || 'user',
      pages: collab.paginas_liberadas || [],
      salary: collab.salary != null ? String(collab.salary) : '',
      functionTitle: collab.function_title || '',
      jobTitle: collab.job_title || '',
      contractType: collab.contract_type || '',
      jobDescription: collab.description || '',
      archetype: collab.archetype || '',
      avatarUrl: collab.avatar_url || null,
    });
    setShowModal(true);
  };

  const handleAvatarChange = async (file: File) => {
    const error = await validateAvatarFile(file);
    if (error) {
      setAvatarError(error);
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicId) {
      setFormError('Nenhuma clínica ativa encontrada.');
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Nome e e-mail são obrigatórios.');
      return;
    }
    if (avatarError && avatarFile) {
      setFormError(avatarError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      let avatarUrl = form.avatarUrl;
      if (avatarFile) {
        avatarUrl = await uploadClinicUserAvatar(clinicId, avatarFile);
      }
      const cleanedPages =
        availablePageOptions.length > 0
          ? form.pages.filter((page) => availablePageSet.has(page))
          : form.pages;

      const payloadUser = {
        clinic_id: clinicId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        paginas_liberadas: cleanedPages,
        avatar_url: avatarUrl || null,
      };

      let clinicUserId = editingId;
      if (editingId) {
        const { error } = await supabase.from('clinic_users').update(payloadUser).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('clinic_users')
          .insert(payloadUser)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        clinicUserId = data?.id || null;
      }

      if (clinicUserId) {
        const payloadCollaborator = {
          clinic_id: clinicId,
          clinic_user_id: clinicUserId,
          birth_date: form.birthDate || null,
          admission_date: form.admissionDate || null,
          salary: form.salary ? Number(form.salary) : null,
          function_title: form.functionTitle || null,
          job_title: form.jobTitle || null,
          contract_type: form.contractType || null,
          description: form.jobDescription || null,
          archetype: form.archetype || null,
        };
        const { error } = await supabase
          .from('hr_collaborators')
          .upsert(payloadCollaborator, { onConflict: 'clinic_user_id' });
        if (error) throw error;
      }

      if (!editingId && resetRedirectUrl) {
        const email = payloadUser.email;
        const { error: inviteError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true, emailRedirectTo: resetRedirectUrl },
        });
        if (inviteError) {
          setFormError(`Usuário criado, mas não foi possível enviar o e-mail: ${inviteError.message}`);
        }
      }

      setShowModal(false);
      setEditingId(null);
      loadCollaborators();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar colaborador.');
    } finally {
      setSaving(false);
    }
  };

  const firstAccessLabel = (collab: any) => (collab.user_id ? 'Realizou' : 'Pendente');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600 font-semibold">Recursos Humanos</p>
          <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} /> Novo colaborador
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaboradores"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={16} />
          {filteredCollaborators.length} registros
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-[70px_1.2fr_1.2fr_140px_140px_160px_150px_120px] gap-4 text-xs uppercase text-gray-400 tracking-wider">
          <span>ID</span>
          <span>Nome</span>
          <span>Email</span>
          <span>Admissão</span>
          <span>Cargo</span>
          <span>Arquétipos</span>
          <span>Primeiro acesso</span>
          <span></span>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Carregando colaboradores...</div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredCollaborators.map((collab: any, idx: number) => {
              const isSelf = clinicUser?.id === collab.id;
              const baseRow = isSelf ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-100';
              const mutedText = isSelf ? 'text-slate-200' : 'text-gray-600';
              const subtleText = isSelf ? 'text-slate-300' : 'text-gray-500';
              const badgeClass = collab.user_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
              return (
                <div
                  key={collab.id}
                  className={`grid grid-cols-[70px_1.2fr_1.2fr_140px_140px_160px_150px_120px] gap-4 items-center rounded-2xl border px-4 py-3 ${baseRow}`}
                >
                  <span className={`text-sm ${subtleText}`}>{String(idx + 1).padStart(2, '0')}</span>
                  <div className="flex items-center gap-3">
                    {collab.avatar_url ? (
                      <img src={collab.avatar_url} alt={collab.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold">
                        {getInitials(collab.name || '', collab.email || '')}
                      </div>
                    )}
                    <span className={`text-sm font-semibold ${isSelf ? 'text-white' : 'text-gray-900'}`}>{collab.name}</span>
                  </div>
                  <span className={`text-sm ${mutedText} break-all`}>{collab.email}</span>
                  <span className={`text-sm ${mutedText}`}>
                    {collab.admission_date ? formatDate(collab.admission_date) : '-'}
                  </span>
                  <span className={`text-sm ${mutedText}`}>{collab.job_title || 'Não informado'}</span>
                  <span className={`text-sm ${subtleText}`}>{collab.archetype || 'Não respondido'}</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full w-fit ${badgeClass}`}>
                    {firstAccessLabel(collab)}
                  </span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setDetailCollaborator(collab)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSelf ? 'border-slate-600 text-white' : 'border-gray-200 text-gray-500'}`}
                      title="Visualizar"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(collab)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSelf ? 'border-slate-600 text-white' : 'border-brand-100 text-brand-600'}`}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Excluir colaborador?')) return;
                        const { error } = await supabase.from('clinic_users').delete().eq('id', collab.id);
                        if (!error) loadCollaborators();
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSelf ? 'border-rose-400 text-rose-200' : 'border-rose-100 text-rose-600'}`}
                      title="Apagar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredCollaborators.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Nenhum colaborador encontrado.</div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar colaborador' : 'Adicionar colaborador'}
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
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
              <div className="space-y-4">
                <div className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center h-40">
                  {avatarPreview || form.avatarUrl ? (
                    <img src={avatarPreview || form.avatarUrl || ''} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">Upload de imagem</span>
                  )}
                </div>
                <label className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center justify-center gap-2 cursor-pointer">
                  + Adicionar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleAvatarChange(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nascimento</label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visualizações menu</label>
                    {availablePageOptions.length === 0 ? (
                      <p className="text-sm text-gray-500">Defina páginas liberadas para a clínica.</p>
                    ) : (
                      <div className="space-y-2">
                        <details ref={pageMenuRef} className="relative">
                          <summary className="list-none cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
                            Selecione
                          </summary>
                          <div className="absolute z-20 mt-2 w-full max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                            {availablePageOptions.map((page) => (
                              <button
                                key={page.value}
                                type="button"
                                onClick={() => {
                                  if (form.pages.includes(page.value)) return;
                                  setForm((prev) => ({ ...prev, pages: [...prev.pages, page.value] }));
                                  if (pageMenuRef.current) pageMenuRef.current.removeAttribute('open');
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                {page.label}
                              </button>
                            ))}
                          </div>
                        </details>
                        <div className="flex flex-wrap gap-2">
                          {form.pages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, pages: prev.pages.filter((p) => p !== page) }))}
                              className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600"
                            >
                              {pageLabelMap[page] || page} ✕
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permissão</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salário</label>
                    <input
                      value={form.salary}
                      onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="R$"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                    <input
                      value={form.functionTitle}
                      onChange={(e) => setForm((prev) => ({ ...prev, functionTitle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Digite aqui"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <input
                      value={form.jobTitle}
                      onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Digite aqui"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de admissão</label>
                    <input
                      type="date"
                      value={form.admissionDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, admissionDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de contrato</label>
                    <select
                      value={form.contractType}
                      onChange={(e) => setForm((prev) => ({ ...prev, contractType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">Selecione</option>
                      {CONTRACT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="example@email.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Arquétipo</label>
                    <input
                      value={form.archetype}
                      onChange={(e) => setForm((prev) => ({ ...prev, archetype: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Digite aqui"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição de função</label>
                  <textarea
                    value={form.jobDescription}
                    onChange={(e) => setForm((prev) => ({ ...prev, jobDescription: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
                    placeholder="Descreva"
                  />
                </div>
                {formError && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{formError}</div>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailCollaborator && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Visualizar colaborador</h3>
              <button
                type="button"
                onClick={() => setDetailCollaborator(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
              <div className="flex flex-col items-center gap-2">
                {detailCollaborator.avatar_url ? (
                  <img
                    src={detailCollaborator.avatar_url}
                    alt={detailCollaborator.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-lg font-semibold">
                    {getInitials(detailCollaborator.name || '', detailCollaborator.email || '')}
                  </div>
                )}
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${detailCollaborator.user_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {firstAccessLabel(detailCollaborator)}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-sm font-semibold text-gray-900">{detailCollaborator.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">E-mail</p>
                  <p className="text-sm text-gray-700 break-all">{detailCollaborator.email}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Admissão</p>
                    <p className="text-sm text-gray-700">
                      {detailCollaborator.admission_date ? formatDate(detailCollaborator.admission_date) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Nascimento</p>
                    <p className="text-sm text-gray-700">
                      {detailCollaborator.birth_date ? formatDate(detailCollaborator.birth_date) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Contrato</p>
                    <p className="text-sm text-gray-700">{detailCollaborator.contract_type || 'Não informado'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Cargo</p>
                    <p className="text-sm text-gray-700">{detailCollaborator.job_title || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Função</p>
                    <p className="text-sm text-gray-700">{detailCollaborator.function_title || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Salário</p>
                    <p className="text-sm text-gray-700">
                      {detailCollaborator.salary ? `R$ ${Number(detailCollaborator.salary).toFixed(2)}` : 'Não informado'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Arquétipo</p>
                  <p className="text-sm text-gray-700">{detailCollaborator.archetype || 'Não respondido'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Descrição</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {detailCollaborator.description || 'Sem descrição'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const collab = detailCollaborator;
                  setDetailCollaborator(null);
                  openEditModal(collab);
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm"
              >
                Editar colaborador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRCollaborators;
