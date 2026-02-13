import React, { useEffect, useRef, useState } from 'react';
import { Plus, Loader2, Users, Mail, Shield, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildPublicUrl } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

const USER_AVATAR_BUCKET = 'user-avatars';
const MAX_AVATAR_DIMENSION = 350;
const ADMIN_PAGE_OPTIONS = [
  { value: '/admin/dashboard', label: 'Dashboard' },
  { value: '/admin/clinics', label: 'Clínicas' },
  { value: '/admin/users', label: 'Usuários' },
  { value: '/admin/team', label: 'Equipe' },
  { value: '/admin/agenda', label: 'Agenda' },
  { value: '/admin/packages', label: 'Pacotes' },
  { value: '/admin/content', label: 'Conteúdos' },
  { value: '/admin/profile', label: 'Perfil' },
];
const ADMIN_PAGE_LABEL_MAP = ADMIN_PAGE_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});
const ADMIN_PAGE_VALUES = new Set(ADMIN_PAGE_OPTIONS.map((item) => item.value));

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

const uploadMemberAvatar = async (memberId: string, file: File) => {
  const safeName = toSafeFileName(file.name);
  const path = `users/${memberId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(USER_AVATAR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const getMemberInitials = (name: string, email: string) => {
  const rawName = name.trim();
  if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  const rawEmail = email.trim();
  if (rawEmail) return rawEmail.slice(0, 2).toUpperCase();
  return 'AD';
};

const AdminTeam: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesEnabled, setInvitesEnabled] = useState(true);
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: 'super_admin',
    email: '',
    avatar_url: null as string | null,
    admin_pages: [] as string[],
  });
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editAvatarError, setEditAvatarError] = useState<string | null>(null);

  const closeEditModal = () => {
    setShowEditModal(false);
    resetEditForm();
  };

  const editModalControls = useModalControls({
    isOpen: showEditModal,
    onClose: closeEditModal,
  });
  const [savingMember, setSavingMember] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamViewMode, setTeamViewMode] = useState<'list' | 'boxes'>('list');
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const callbackUrl = buildPublicUrl('/auth/callback');
  const adminPagesRef = useRef<HTMLDetailsElement | null>(null);

  const fetchMembers = async () => {
    const { data, error: membersError } = await (supabase as any)
      .rpc('list_system_admins');
    if (!membersError && data) {
      setMembers(data as any[]);
      return;
    }
    const { data: fallback, error: fallbackError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at, avatar_url, admin_pages')
      .in('role', ['system_owner', 'super_admin'])
      .order('created_at', { ascending: false });
    if (!fallbackError && fallback) setMembers(fallback as any[]);
  };

  const fetchInvites = async () => {
    const { data, error: invitesError } = await (supabase as any)
      .from('system_admin_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (invitesError) {
      if (invitesError.message?.includes('does not exist')) {
        setInvitesEnabled(false);
      }
      return;
    }
    setInvites(data as any[]);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchMembers();
    await fetchInvites();
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    return () => {
      if (editAvatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(editAvatarPreview);
      }
    };
  }, [editAvatarPreview]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitesEnabled) return;
    const email = form.email.trim().toLowerCase();
    const fullName = form.full_name.trim();
    if (!email) {
      setError('Informe um e-mail válido.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { data: existingClinicUser } = await supabase
        .from('clinic_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existingClinicUser) {
        setError('Este e-mail já está vinculado a uma clínica.');
        setSending(false);
        return;
      }
      const { data: existingInvite } = await (supabase as any)
        .from('system_admin_invites')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existingInvite) {
        setError('Já existe um convite pendente para este e-mail.');
        setSending(false);
        return;
      }
      try {
        const { data: existingClinicInvite } = await (supabase as any)
          .from('clinic_invites')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (existingClinicInvite) {
          setError('Este e-mail já está em um convite de clínica.');
          setSending(false);
          return;
        }
      } catch {
        // ignore missing table
      }

      const { error: inviteError } = await (supabase as any).from('system_admin_invites').insert([
        {
          email,
          full_name: fullName || null,
          role: 'super_admin',
          invited_by: user?.id || null,
        },
      ]);
      if (inviteError) throw inviteError;

      const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
      if (callbackUrl) otpOptions.emailRedirectTo = callbackUrl;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: otpOptions,
      });
      if (otpError) {
        setError(`Convite criado, mas não foi possível enviar o e-mail: ${otpError.message}`);
      }

      setForm({ full_name: '', email: '' });
      await fetchInvites();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar convite.');
    } finally {
      setSending(false);
    }
  };

  const resetEditForm = () => {
    setEditingMemberId(null);
    setEditForm({ full_name: '', role: 'super_admin', email: '', avatar_url: null, admin_pages: [] });
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditAvatarError(null);
  };

  const openEditMember = (member: any) => {
    setEditingMemberId(member.id);
    setEditForm({
      full_name: member.full_name || '',
      role: member.role || 'super_admin',
      email: member.email || '',
      avatar_url: member.avatar_url || null,
      admin_pages: member.admin_pages || [],
    });
    setError(null);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditAvatarError(null);
    setShowEditModal(true);
  };

  const handleEditAvatarChange = async (file: File) => {
    const error = await validateAvatarFile(file);
    if (error) {
      setEditAvatarError(error);
      setEditAvatarFile(null);
      setEditAvatarPreview(null);
      return;
    }
    setEditAvatarError(null);
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const handleUpdateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMemberId) return;
    if (editAvatarError && editAvatarFile) {
      setError(editAvatarError);
      return;
    }
    setSavingMember(true);
    setError(null);
    try {
      let avatarUrl = editForm.avatar_url || null;
      if (editAvatarFile) {
        avatarUrl = await uploadMemberAvatar(editingMemberId, editAvatarFile);
      }
      const cleanedAdminPages = editForm.admin_pages.filter((page) => ADMIN_PAGE_VALUES.has(page));
      const payload = {
        full_name: editForm.full_name.trim() || null,
        role: editForm.role,
        avatar_url: avatarUrl,
        admin_pages: cleanedAdminPages,
      };
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', editingMemberId);
      if (updateError) throw updateError;
      await fetchMembers();
      setShowEditModal(false);
      resetEditForm();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar administrador.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (member: any) => {
    if (member.id === user?.id) {
      alert('Você não pode remover o seu próprio usuário.');
      return;
    }
    if (!confirm('Excluir este administrador?')) return;
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', member.id);
    if (deleteError) {
      alert('Erro ao excluir administrador: ' + deleteError.message);
      return;
    }
    await fetchMembers();
  };

  const handleResendInvite = async (invite: any) => {
    if (!invite?.email) return;
    if (!confirm(`Reenviar convite para ${invite.email}?`)) return;
    setResendingInviteId(invite.id);
    try {
      const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
      if (callbackUrl) otpOptions.emailRedirectTo = callbackUrl;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: invite.email,
        options: otpOptions,
      });
      if (otpError) throw otpError;
    } catch (err: any) {
      alert(`Não foi possível reenviar o convite: ${err.message || 'Erro inesperado.'}`);
    } finally {
      setResendingInviteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Equipe</h1>
        <p className="text-gray-500">Cadastre administradores da plataforma (super admin).</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-800 font-semibold">
          <Shield size={16} />
          Novo administrador
        </div>
        {!invitesEnabled ? (
          <div className="text-sm text-gray-500">
            Tabela de convites indisponível. Rode as migrations do Supabase.
          </div>
        ) : (
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome completo"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  placeholder="email@dominio.com"
                />
              </div>
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Criar convite
              </button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Users size={16} />
            Administradores atuais
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setTeamViewMode('list')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-2 ${teamViewMode === 'list' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              aria-pressed={teamViewMode === 'list'}
            >
              <List size={14} /> Lista
            </button>
            <button
              type="button"
              onClick={() => setTeamViewMode('boxes')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-2 ${teamViewMode === 'boxes' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              aria-pressed={teamViewMode === 'boxes'}
            >
              <LayoutGrid size={14} /> Boxes
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400">Carregando equipe...</div>
        ) : teamViewMode === 'list' ? (
          <div className="border border-gray-100 rounded-lg divide-y">
            {members.map((member) => (
              <div key={member.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={`Foto de ${member.full_name || 'admin'}`} className="h-full w-full object-cover object-center" />
                    ) : (
                      <span>{getMemberInitials(member.full_name || '', member.email || '')}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{member.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-gray-500">{member.email || 'E-mail não disponível'}</p>
                    <p className="text-xs text-gray-500">Role: {member.role}</p>
                    {member.admin_pages && member.admin_pages.length > 0 ? (
                      <p className="text-xs text-gray-500">
                        Admin: {member.admin_pages.map((page: string) => ADMIN_PAGE_LABEL_MAP[page] || page).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Admin: acesso completo</p>
                    )}
                    <p className="text-xs text-gray-400">ID: {member.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditMember(member)}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(member)}
                    className="text-sm text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum administrador cadastrado.</div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div key={member.id} className="border border-gray-100 rounded-lg p-4 bg-white flex flex-col gap-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={`Foto de ${member.full_name || 'admin'}`} className="h-full w-full object-cover object-center" />
                    ) : (
                      <span>{getMemberInitials(member.full_name || '', member.email || '')}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{member.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-gray-500 break-all">{member.email || 'E-mail não disponível'}</p>
                    <p className="text-xs text-gray-500">Role: {member.role}</p>
                    {member.admin_pages && member.admin_pages.length > 0 ? (
                      <p className="text-xs text-gray-500 break-words">
                        Admin: {member.admin_pages.map((page: string) => ADMIN_PAGE_LABEL_MAP[page] || page).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Admin: acesso completo</p>
                    )}
                    <p className="text-xs text-gray-400">ID: {member.id}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openEditMember(member)}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(member)}
                    className="text-sm text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="col-span-full p-4 text-sm text-gray-400 text-center">Nenhum administrador cadastrado.</div>
            )}
          </div>
        )}
      </div>

      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={editModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">Editar administrador</h4>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagem</label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-16 w-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                    {editAvatarPreview || editForm.avatar_url ? (
                      <img
                        src={editAvatarPreview || editForm.avatar_url || ''}
                        alt="Avatar do administrador"
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <span>{getMemberInitials(editForm.full_name || '', editForm.email || '')}</span>
                    )}
                  </div>
                  <label className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    {editAvatarPreview || editForm.avatar_url ? 'Trocar imagem' : 'Adicionar imagem'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await handleEditAvatarChange(file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-500">Quadrada até 350 x 350.</span>
                </div>
                {editAvatarError && <p className="text-xs text-red-600 mt-1">{editAvatarError}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    value={editForm.email || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível de acesso</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                  >
                    <option value="system_owner">System Owner</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Páginas de admin</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, admin_pages: ADMIN_PAGE_OPTIONS.map((p) => p.value) }))}
                      className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                    >
                      Selecionar tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, admin_pages: [] }))}
                      className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="space-y-2">
                    <details ref={adminPagesRef} className="relative">
                      <summary className="list-none cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
                        Selecionar página...
                      </summary>
                      <div className="absolute z-20 mt-2 w-full max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                        {ADMIN_PAGE_OPTIONS.map((page) => (
                          <button
                            key={page.value}
                            type="button"
                            onClick={() => {
                              if (editForm.admin_pages.includes(page.value)) return;
                              setEditForm((prev) => ({
                                ...prev,
                                admin_pages: [...prev.admin_pages, page.value],
                              }));
                              if (adminPagesRef.current) adminPagesRef.current.removeAttribute('open');
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    </details>
                    <div className="flex flex-wrap gap-2">
                      {editForm.admin_pages.map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              admin_pages: prev.admin_pages.filter((p) => p !== page),
                            }))
                          }
                          className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
                        >
                          {ADMIN_PAGE_LABEL_MAP[page] || page} ✕
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetEditForm();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingMember ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {invitesEnabled && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Mail size={16} />
            Convites pendentes
          </div>
          <div className="border border-gray-100 rounded-lg divide-y">
            {invites.map((invite) => (
              <div key={invite.id} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{invite.full_name || 'Sem nome'}</p>
                  <p className="text-xs text-gray-500">{invite.email}</p>
                  <p className="text-xs text-gray-400">Role: {invite.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleResendInvite(invite)}
                    disabled={resendingInviteId === invite.id}
                    className="text-sm text-sky-600 disabled:opacity-50"
                  >
                    {resendingInviteId === invite.id ? 'Enviando...' : 'Reenviar convite'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Revogar convite?')) return;
                      await (supabase as any).from('system_admin_invites').delete().eq('id', invite.id);
                      fetchInvites();
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            ))}
            {invites.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum convite pendente.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeam;
