import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Building2, Wallet, RefreshCw, Plus, Loader2, CheckSquare, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildPublicUrl, formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

interface AdminProps {
  initialTab?: 'overview' | 'clinics' | 'users';
}

const USER_AVATAR_BUCKET = 'user-avatars';
const MAX_AVATAR_DIMENSION = 350;

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

const validateSquareImage = async (file: File) => {
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

const uploadClinicLogo = async (clinicId: string, file: File) => {
  const safeName = toSafeFileName(file.name);
  const path = `clinics/${clinicId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(USER_AVATAR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const getClinicInitials = (name: string) => {
  const rawName = name.trim();
  if (!rawName) return 'CL';
  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const Admin: React.FC<AdminProps> = ({ initialTab = 'overview' }) => {
  const navigate = useNavigate();
  const { isSystemAdmin, selectedClinicId, setSelectedClinicId } = useAuth();
  
  const COMMERCIAL_PRODUCT_OPTIONS = [
    'Plataforma OnePay',
    'Cursos',
    'Consultoria',
    'Mentoria',
    'Suporte',
    'Onboarding',
  ];
  const [tab, setTab] = useState<'overview' | 'clinics' | 'users'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<any[]>([]);
  const [clinicForm, setClinicForm] = useState({
    name: '',
    responsavel_nome: '',
    documento: '',
    email_contato: '',
    telefone_contato: '',
    plano: 'basico',
    paginas_liberadas: [] as string[],
    package_id: '',
    ativo: true,
    logo_url: null as string | null,
    commercial_products: [] as string[],
    commercial_package_id: '',
    commercial_amount: '',
    commercial_start_date: '',
    commercial_end_date: '',
    commercial_status: 'ativo',
    commercial_owner_user_id: '',
  });
  const [clinicLogoFile, setClinicLogoFile] = useState<File | null>(null);
  const [clinicLogoPreview, setClinicLogoPreview] = useState<string | null>(null);
  const [clinicLogoError, setClinicLogoError] = useState<string | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [clinicPackageMap, setClinicPackageMap] = useState<Record<string, string[]>>({});
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showCreateClinicModal, setShowCreateClinicModal] = useState(false);
  const [editClinicForm, setEditClinicForm] = useState({
    name: '',
    responsavel_nome: '',
    documento: '',
    email_contato: '',
    telefone_contato: '',
    plano: 'basico',
    paginas_liberadas: [] as string[],
    package_id: '',
    ativo: true,
    logo_url: null as string | null,
    commercial_products: [] as string[],
    commercial_package_id: '',
    commercial_amount: '',
    commercial_start_date: '',
    commercial_end_date: '',
    commercial_status: 'ativo',
    commercial_owner_user_id: '',
  });
  const [editClinicLogoFile, setEditClinicLogoFile] = useState<File | null>(null);
  const [editClinicLogoPreview, setEditClinicLogoPreview] = useState<string | null>(null);
  const [editClinicLogoError, setEditClinicLogoError] = useState<string | null>(null);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [clinicViewMode, setClinicViewMode] = useState<'list' | 'boxes'>('list');
  const [clinicUsers, setClinicUsers] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [contractProductInput, setContractProductInput] = useState('');
  const [editContractProductInput, setEditContractProductInput] = useState('');
  const [userForm, setUserForm] = useState({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] as string[] });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] as string[] });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bulkUserRole, setBulkUserRole] = useState('user');
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [resendingAccessId, setResendingAccessId] = useState<string | null>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesEnabled, setInvitesEnabled] = useState(true);
  const [inviteForm, setInviteForm] = useState({ clinic_id: '', email: '', role: 'user' });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const callbackUrl = buildPublicUrl('/auth/callback');
  const tabRoutes: Record<'overview' | 'clinics' | 'users', string> = {
    overview: '/admin/dashboard',
    clinics: '/admin/clinics',
    users: '/admin/users',
  };

  const fetchClinics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, bank_accounts (id), categories (id), clinic_users (id, ativo)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClinics((data || []) as any[]);
    } catch (err) {
      console.error('Erro ao carregar clínicas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    const { data, error } = await (supabase as any)
      .from('content_packages')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setPackages((data || []) as any[]);
  };

  const fetchInternalUsers = async () => {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales'])
      .order('full_name', { ascending: true });
    setInternalUsers((data || []) as any[]);
  };

  const fetchClinicPackages = async () => {
    const { data, error } = await (supabase as any)
      .from('clinic_packages')
      .select('clinic_id, package_id');
    if (error) return;
    const map: Record<string, string[]> = {};
    (data || []).forEach((row: any) => {
      if (!row.clinic_id || !row.package_id) return;
      if (!map[row.clinic_id]) map[row.clinic_id] = [];
      map[row.clinic_id].push(row.package_id);
    });
    setClinicPackageMap(map);
  };

  const saveClinicPackages = async (clinicId: string, packageId: string) => {
    await (supabase as any).from('clinic_packages').delete().eq('clinic_id', clinicId);
    if (packageId) {
      const rows = [{ clinic_id: clinicId, package_id: packageId }];
      await (supabase as any).from('clinic_packages').insert(rows);
    }
    fetchClinicPackages();
  };

  const resolvePackagePages = (packageId: string) => {
    if (!packageId) return [];
    const pkg = packages.find((item) => item.id === packageId);
    if (!pkg?.pages || !Array.isArray(pkg.pages)) return [];
    return pkg.pages.map((page: string) => page.trim()).filter(Boolean);
  };

  const resolveClinicPackagePages = (clinicId: string) => {
    const packageIds = clinicPackageMap[clinicId] || [];
    const pages = packageIds.flatMap((packageId) => resolvePackagePages(packageId));
    return Array.from(new Set(pages));
  };

  const parseAmountToCents = (value: string) => {
    if (!value) return null;
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100);
  };

  const formatCentsToInput = (value?: number | null) => {
    if (!value && value !== 0) return '';
    return (value / 100).toFixed(2).replace('.', ',');
  };

  const normalizeProductInput = (value: string) => value.trim().replace(/\s+/g, ' ');

  const addCommercialProduct = (value: string, target: 'create' | 'edit') => {
    const normalized = normalizeProductInput(value);
    if (!normalized) return;
    if (target === 'create') {
      setClinicForm((prev) => {
        if (prev.commercial_products.includes(normalized)) return prev;
        return { ...prev, commercial_products: [...prev.commercial_products, normalized] };
      });
      setContractProductInput('');
    } else {
      setEditClinicForm((prev) => {
        if (prev.commercial_products.includes(normalized)) return prev;
        return { ...prev, commercial_products: [...prev.commercial_products, normalized] };
      });
      setEditContractProductInput('');
    }
  };

  const removeCommercialProduct = (value: string, target: 'create' | 'edit') => {
    if (target === 'create') {
      setClinicForm((prev) => ({
        ...prev,
        commercial_products: prev.commercial_products.filter((item) => item !== value),
      }));
    } else {
      setEditClinicForm((prev) => ({
        ...prev,
        commercial_products: prev.commercial_products.filter((item) => item !== value),
      }));
    }
  };

  const handleToggleClinics = async (ids: string[], ativo: boolean) => {
    if (!ids.length) return;
    const { error } = await supabase.from('clinics').update({ ativo }).in('id', ids);
    if (error) {
      alert('Erro ao atualizar clínicas: ' + error.message);
      return;
    }
    setSelectedClinics([]);
    fetchClinics();
  };

  const resetClinicForm = () => {
    setClinicForm({
      name: '',
      responsavel_nome: '',
      documento: '',
      email_contato: '',
      telefone_contato: '',
      plano: 'basico',
      paginas_liberadas: [],
      package_id: '',
      ativo: true,
      logo_url: null,
      commercial_products: [],
      commercial_package_id: '',
      commercial_amount: '',
      commercial_start_date: '',
      commercial_end_date: '',
      commercial_status: 'ativo',
      commercial_owner_user_id: '',
    });
    setClinicLogoFile(null);
    setClinicLogoPreview(null);
    setClinicLogoError(null);
    setContractProductInput('');
  };

  const resetEditClinicForm = () => {
    setEditingClinicId(null);
    setEditClinicForm({
      name: '',
      responsavel_nome: '',
      documento: '',
      email_contato: '',
      telefone_contato: '',
      plano: 'basico',
      paginas_liberadas: [],
      package_id: '',
      ativo: true,
      logo_url: null,
      commercial_products: [],
      commercial_package_id: '',
      commercial_amount: '',
      commercial_start_date: '',
      commercial_end_date: '',
      commercial_status: 'ativo',
      commercial_owner_user_id: '',
    });
    setEditClinicLogoFile(null);
    setEditClinicLogoPreview(null);
    setEditClinicLogoError(null);
    setEditContractProductInput('');
  };

  const closeClinicModal = () => {
    setShowClinicModal(false);
    resetEditClinicForm();
  };

  const closeCreateClinicModal = () => {
    setShowCreateClinicModal(false);
    resetClinicForm();
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUserId(null);
    setEditUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
  };

  const clinicModalControls = useModalControls({
    isOpen: showClinicModal,
    onClose: closeClinicModal,
  });

  const createClinicModalControls = useModalControls({
    isOpen: showCreateClinicModal,
    onClose: closeCreateClinicModal,
  });

  const userModalControls = useModalControls({
    isOpen: showUserModal,
    onClose: closeUserModal,
  });

  const handleClinicLogoChange = async (file: File) => {
    const error = await validateSquareImage(file);
    if (error) {
      setClinicLogoError(error);
      setClinicLogoFile(null);
      setClinicLogoPreview(null);
      return;
    }
    setClinicLogoError(null);
    setClinicLogoFile(file);
    setClinicLogoPreview(URL.createObjectURL(file));
  };

  const handleEditClinicLogoChange = async (file: File) => {
    const error = await validateSquareImage(file);
    if (error) {
      setEditClinicLogoError(error);
      setEditClinicLogoFile(null);
      setEditClinicLogoPreview(null);
      return;
    }
    setEditClinicLogoError(null);
    setEditClinicLogoFile(file);
    setEditClinicLogoPreview(URL.createObjectURL(file));
  };

  const openEditClinicModal = (clinic: any) => {
    setEditingClinicId(clinic.id);
    setEditClinicForm({
      name: clinic.name || '',
      responsavel_nome: clinic.responsavel_nome || '',
      documento: clinic.documento || '',
      email_contato: clinic.email_contato || '',
      telefone_contato: clinic.telefone_contato || '',
      plano: clinic.plano || 'basico',
      paginas_liberadas: clinic.paginas_liberadas || [],
      package_id: (clinicPackageMap[clinic.id] || [])[0] || '',
      ativo: clinic.ativo ?? true,
      logo_url: clinic.logo_url || null,
      commercial_products: [],
      commercial_package_id: '',
      commercial_amount: '',
      commercial_start_date: '',
      commercial_end_date: '',
      commercial_status: 'ativo',
      commercial_owner_user_id: '',
    });
    setEditClinicLogoFile(null);
    setEditClinicLogoPreview(null);
    setEditClinicLogoError(null);
    setEditContractProductInput('');
    loadClinicContract(clinic.id);
    setShowClinicModal(true);
  };

  const openCreateClinicModal = () => {
    resetClinicForm();
    setShowCreateClinicModal(true);
  };

  const loadClinicContract = async (clinicId: string) => {
    if (!clinicId) return;
    const { data } = await (supabase as any)
      .from('commercial_contracts')
      .select('products, package_id, amount_cents, start_date, end_date, status, owner_user_id')
      .eq('clinic_id', clinicId)
      .maybeSingle();
    if (!data) return;
    setEditClinicForm((prev) => ({
      ...prev,
      commercial_products: Array.isArray(data.products) ? data.products : [],
      commercial_package_id: data.package_id || '',
      commercial_amount: formatCentsToInput(data.amount_cents),
      commercial_start_date: data.start_date || '',
      commercial_end_date: data.end_date || '',
      commercial_status: data.status || 'ativo',
      commercial_owner_user_id: data.owner_user_id || '',
    }));
  };

  const persistClinicContract = async (clinicId: string, form: typeof clinicForm) => {
    if (!clinicId) return;
    const hasData =
      form.commercial_products.length ||
      form.commercial_package_id ||
      form.commercial_amount ||
      form.commercial_start_date ||
      form.commercial_end_date ||
      form.commercial_owner_user_id;
    if (!hasData) {
      await (supabase as any).from('commercial_contracts').delete().eq('clinic_id', clinicId);
      return;
    }
    const amountCents = parseAmountToCents(form.commercial_amount);
    const payload = {
      clinic_id: clinicId,
      products: form.commercial_products || [],
      package_id: form.commercial_package_id || null,
      amount_cents: amountCents,
      start_date: form.commercial_start_date || null,
      end_date: form.commercial_end_date || null,
      status: form.commercial_status || 'ativo',
      owner_user_id: form.commercial_owner_user_id || null,
    };
    await (supabase as any).from('commercial_contracts').upsert(payload, { onConflict: 'clinic_id' });
  };

  const openEditUserModal = (user: any) => {
    setEditingUserId(user.id);
    setEditUserForm({
      clinic_id: user.clinic_id || '',
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'user',
      ativo: user.ativo ?? true,
      paginas_liberadas: user.paginas_liberadas || [],
    });
    setShowUserModal(true);
  };

  const handleCreateClinic = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicForm.name.trim()) return;
    if (clinicLogoError && clinicLogoFile) {
      alert(clinicLogoError);
      return;
    }
    setSavingClinic(true);
    try {
      const { package_id, ...clinicPayload } = clinicForm;
      delete (clinicPayload as any).commercial_products;
      delete (clinicPayload as any).commercial_package_id;
      delete (clinicPayload as any).commercial_amount;
      delete (clinicPayload as any).commercial_start_date;
      delete (clinicPayload as any).commercial_end_date;
      delete (clinicPayload as any).commercial_status;
      delete (clinicPayload as any).commercial_owner_user_id;
      delete (clinicPayload as any).paginas_liberadas;
      const selectedPackage = packages.find((pkg) => pkg.id === package_id);
      const payloadWithPlan = {
        ...clinicPayload,
        plano: selectedPackage?.name || clinicForm.plano || 'basico',
      };
      const contactEmail = payloadWithPlan.email_contato?.trim().toLowerCase();
      if (contactEmail) {
        const { data: existingUser } = await supabase
          .from('clinic_users')
          .select('id, clinic_id')
          .eq('email', contactEmail)
          .maybeSingle();
        if (existingUser) {
          alert('Já existe um usuário com este e-mail em outra clínica. Use um e-mail diferente.');
          return;
        }
      }
      const { data: createdClinic, error } = await supabase
        .from('clinics')
        .insert([{ ...payloadWithPlan }])
        .select()
        .single();
      if (error) throw error;
      if (createdClinic?.id && clinicLogoFile) {
        try {
          const logoUrl = await uploadClinicLogo(createdClinic.id, clinicLogoFile);
          await supabase.from('clinics').update({ logo_url: logoUrl }).eq('id', createdClinic.id);
        } catch (logoError: any) {
          alert(`Clínica criada, mas não foi possível enviar a imagem: ${logoError.message}`);
        }
      }
      if (createdClinic?.id && contactEmail) {
        const defaultPages = resolvePackagePages(package_id || '');
        const { data: existingUser } = await supabase
          .from('clinic_users')
          .select('id')
          .eq('clinic_id', createdClinic.id)
          .eq('email', contactEmail)
          .maybeSingle();
        if (!existingUser) {
          const { error: userError } = await supabase.from('clinic_users').insert({
            clinic_id: createdClinic.id,
            email: contactEmail,
            name: clinicForm.responsavel_nome?.trim() || contactEmail.split('@')[0] || 'Responsável',
            role: 'owner',
            ativo: true,
            paginas_liberadas: defaultPages,
          });
          if (userError) {
            console.warn('Erro ao criar usuário da clínica:', userError.message);
            alert(`Clínica criada, mas não foi possível criar o usuário automaticamente: ${userError.message}`);
          } else {
            const redirectTo = callbackUrl ? `${callbackUrl}?redirectTo=${encodeURIComponent('/')}` : undefined;
            const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
            if (redirectTo) otpOptions.emailRedirectTo = redirectTo;
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email: contactEmail,
              options: otpOptions,
            });
            if (otpError) {
              alert(`Usuário criado, mas não foi possível enviar o e-mail de acesso: ${otpError.message}`);
            }
          }
        }
      }
      if (createdClinic?.id) {
        await saveClinicPackages(createdClinic.id, package_id || '');
        await persistClinicContract(createdClinic.id, clinicForm);
      }
      resetClinicForm();
      setShowCreateClinicModal(false);
      fetchClinics();
    } catch (err: any) {
      alert('Erro ao salvar clínica: ' + err.message);
    } finally {
      setSavingClinic(false);
    }
  };

  const handleUpdateClinic = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingClinicId) return;
    if (!editClinicForm.name.trim()) return;
    if (editClinicLogoError && editClinicLogoFile) {
      alert(editClinicLogoError);
      return;
    }
    setSavingClinic(true);
    try {
      const { package_id, ...clinicPayload } = editClinicForm;
      delete (clinicPayload as any).commercial_products;
      delete (clinicPayload as any).commercial_package_id;
      delete (clinicPayload as any).commercial_amount;
      delete (clinicPayload as any).commercial_start_date;
      delete (clinicPayload as any).commercial_end_date;
      delete (clinicPayload as any).commercial_status;
      delete (clinicPayload as any).commercial_owner_user_id;
      delete (clinicPayload as any).paginas_liberadas;
      const selectedPackage = packages.find((pkg) => pkg.id === package_id);
      const payloadWithPlan = {
        ...clinicPayload,
        plano: selectedPackage?.name || editClinicForm.plano || 'basico',
      };
      let logoUrl = editClinicForm.logo_url || null;
      if (editClinicLogoFile) {
        logoUrl = await uploadClinicLogo(editingClinicId, editClinicLogoFile);
      }
      const { error } = await supabase
        .from('clinics')
        .update({ ...payloadWithPlan, logo_url: logoUrl })
        .eq('id', editingClinicId);
      if (error) throw error;
      await saveClinicPackages(editingClinicId, package_id || '');
      await persistClinicContract(editingClinicId, editClinicForm);
      setShowClinicModal(false);
      resetEditClinicForm();
      fetchClinics();
    } catch (err: any) {
      alert('Erro ao atualizar clínica: ' + err.message);
    } finally {
      setSavingClinic(false);
    }
  };

  const handleDeleteClinic = async (clinic: any) => {
    const label = clinic.name || clinic.id || 'esta clínica';
    if (!confirm(`Excluir ${label}? Essa ação é permanente.`)) return;
    try {
      await (supabase as any).from('clinic_packages').delete().eq('clinic_id', clinic.id);
      const { error } = await supabase.from('clinics').delete().eq('id', clinic.id);
      if (error) throw error;
      setClinics((prev) => prev.filter((item) => item.id !== clinic.id));
      setSelectedClinics((prev) => prev.filter((id) => id !== clinic.id));
      if (editingClinicId === clinic.id) {
        setShowClinicModal(false);
        resetEditClinicForm();
      }
    } catch (err: any) {
      alert('Erro ao excluir clínica: ' + err.message);
    }
  };

  const resolveClinicAccessEmail = async (clinic: any) => {
    const contactEmail = clinic.email_contato?.trim().toLowerCase() || '';
    const { data, error } = await supabase
      .from('clinic_users')
      .select('email, role, ativo, created_at')
      .eq('clinic_id', clinic.id)
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const activeUsers = (data || []).filter((u: any) => !!u.email);
    if (!activeUsers.length) return contactEmail;
    const matchesContact = contactEmail
      ? activeUsers.find((u: any) => u.email?.trim().toLowerCase() === contactEmail)
      : null;
    if (matchesContact) return contactEmail;
    const owner = activeUsers.find((u: any) => u.role === 'owner');
    if (owner?.email) return owner.email.trim().toLowerCase();
    const admin = activeUsers.find((u: any) => u.role === 'admin');
    if (admin?.email) return admin.email.trim().toLowerCase();
    return activeUsers[0]?.email?.trim().toLowerCase() || contactEmail;
  };

  const handleResendClinicAccess = async (clinic: any) => {
    if (!clinic?.id) return;
    setResendingAccessId(clinic.id);
    try {
      const targetEmail = await resolveClinicAccessEmail(clinic);
      if (!targetEmail) {
        alert('Sem e-mail de acesso disponível. Cadastre um usuário ativo ou o e-mail de contato da clínica.');
        return;
      }
      if (!confirm(`Reenviar acesso para ${targetEmail}?`)) return;
      const redirectTo = callbackUrl ? `${callbackUrl}?redirectTo=${encodeURIComponent('/')}` : undefined;
      const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
      if (redirectTo) otpOptions.emailRedirectTo = redirectTo;
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: otpOptions,
      });
      if (error) throw error;
      alert(`Acesso reenviado para ${targetEmail}.`);
    } catch (err: any) {
      alert('Não foi possível reenviar o acesso: ' + err.message);
    } finally {
      setResendingAccessId(null);
    }
  };

  const handleCreateUser = async () => {
    setSavingUser(true);
    try {
      const normalizedEmail = userForm.email.trim().toLowerCase();
      if (!normalizedEmail) {
        alert('Informe um e-mail válido.');
        return;
      }
      const { data: existingUser } = await supabase
        .from('clinic_users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (existingUser) {
        alert('Já existe um usuário com este e-mail em outra clínica. Use um e-mail diferente.');
        return;
      }
      const clinicId = userForm.clinic_id;
      if (!clinicId) {
        alert('Selecione a clínica do usuário.');
        return;
      }
      const packagePages = resolveClinicPackagePages(clinicId);
      if (!packagePages.length) {
        alert('Defina um pacote com páginas para esta clínica antes de criar usuários.');
        return;
      }
      const { error } = await supabase
        .from('clinic_users')
        .insert([{ ...userForm, email: normalizedEmail, paginas_liberadas: packagePages }]);
      if (error) throw error;
      if (normalizedEmail) {
        const redirectTo = callbackUrl ? `${callbackUrl}?redirectTo=${encodeURIComponent('/')}` : undefined;
        const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
        if (redirectTo) otpOptions.emailRedirectTo = redirectTo;
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: otpOptions,
        });
        if (otpError) {
          alert('Usuário criado, mas não foi possível enviar o email de acesso: ' + otpError.message);
        }
      }
      const { data } = await supabase.from('clinic_users').select('*').order('created_at', { ascending: false });
      if (data) setClinicUsers(data as any[]);
      setUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
    } catch (err: any) {
      alert('Erro ao salvar usuário: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUser = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingUserId) return;
    setSavingUser(true);
    try {
      const normalizedEmail = editUserForm.email.trim().toLowerCase();
      if (!normalizedEmail) {
        alert('Informe um e-mail válido.');
        return;
      }
      const { data: existingUser } = await supabase
        .from('clinic_users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (existingUser && existingUser.id !== editingUserId) {
        alert('Já existe um usuário com este e-mail em outra clínica. Use um e-mail diferente.');
        return;
      }
      const userPayload = { ...editUserForm } as any;
      delete userPayload.paginas_liberadas;
      const { error } = await supabase
        .from('clinic_users')
        .update({ ...userPayload, email: normalizedEmail })
        .eq('id', editingUserId);
      if (error) throw error;
      const { data } = await supabase.from('clinic_users').select('*').order('created_at', { ascending: false });
      if (data) setClinicUsers(data as any[]);
      setShowUserModal(false);
      setEditingUserId(null);
      setEditUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
    } catch (err: any) {
      alert('Erro ao atualizar usuário: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    const label = user.name || user.email || 'este usuário';
    if (!confirm(`Excluir ${label}?`)) return;
    const { error } = await supabase
      .from('clinic_users')
      .delete()
      .eq('id', user.id);
    if (error) {
      alert('Erro ao excluir usuário: ' + error.message);
      return;
    }
    setClinicUsers((prev) => prev.filter((item) => item.id !== user.id));
    setSelectedUsers((prev) => prev.filter((id) => id !== user.id));
    if (editingUserId === user.id) {
      setShowUserModal(false);
      setEditingUserId(null);
      setEditUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
    }
  };

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (next: 'overview' | 'clinics' | 'users') => {
    setTab(next);
    navigate(tabRoutes[next]);
  };

  useEffect(() => {
    fetchClinics();
    fetchPackages();
    fetchClinicPackages();
    fetchInternalUsers();
    supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setClinicUsers(data as any[]);
    });
    (supabase as any).from('clinic_invites').select('*').order('created_at', { ascending: false }).then(({ data, error }: any) => {
      if (error) {
        console.warn('Convites indisponíveis (tabela ausente?):', error.message);
        setInvitesEnabled(false);
        return;
      }
      setInvites(data as any[] || []);
    });
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id || null));
  }, []);

  useEffect(() => {
    return () => {
      if (clinicLogoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(clinicLogoPreview);
      }
    };
  }, [clinicLogoPreview]);

  useEffect(() => {
    return () => {
      if (editClinicLogoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(editClinicLogoPreview);
      }
    };
  }, [editClinicLogoPreview]);

  const totals = useMemo(() => {
    const totalClinics = clinics.length;
    const totalUsers = clinics.reduce((acc, c) => acc + (c.clinic_users?.length || 0), 0);
    const totalUsersAtivos = clinics.reduce(
      (acc, c) => acc + (c.clinic_users?.filter((u: any) => u.ativo !== false).length || 0),
      0
    );
    const totalAccounts = clinics.reduce((acc, c) => acc + (c.bank_accounts?.length || 0), 0);
    return { totalClinics, totalUsers, totalUsersAtivos, totalAccounts };
  }, [clinics]);

  const filteredClinics = useMemo(() => {
    return clinics.filter(c => {
      const matchName = c.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'todas' ||
        (statusFilter === 'ativas' && c.ativo !== false) ||
        (statusFilter === 'inativas' && c.ativo === false);
      return matchName && matchStatus;
    });
  }, [clinics, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield size={22} /> Administrador
          </h1>
          <p className="text-gray-500">Visão geral de todos os clientes (multiusuário)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'overview' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Visão geral
          </button>
          <button
            onClick={() => handleTabChange('clinics')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'clinics' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Clínicas
          </button>
          <button
            onClick={() => handleTabChange('users')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'users' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Usuários
          </button>
          <button
            onClick={fetchClinics}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Clínicas</p>
                <p className="text-xl font-bold text-gray-800">{totals.totalClinics}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Usuários</p>
                <p className="text-xl font-bold text-gray-800">
                  {totals.totalUsers} <span className="text-xs text-gray-500">({totals.totalUsersAtivos} ativos)</span>
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Contas Bancárias</p>
                <p className="text-xl font-bold text-gray-800">{totals.totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">Clínicas</p>
                <p className="text-sm text-gray-500">Dados gerais de todos os clientes</p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar clínica por nome..."
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="todas">Todas</option>
                  <option value="ativas">Ativas</option>
                  <option value="inativas">Inativas</option>
                </select>
              </div>
            </div>
            <div className="table-scroll">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-6 py-3">Criada em</th>
                    <th className="px-6 py-3">Plano</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Usuários</th>
                    <th className="px-6 py-3">Contas</th>
                    <th className="px-6 py-3">Categorias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">Carregando...</td></tr>
                  )}
                  {!loading && filteredClinics.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">Nenhuma clínica encontrada.</td></tr>
                  )}
                  {!loading && filteredClinics.map(clinic => (
                    <tr key={clinic.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-800">{clinic.name}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(clinic.created_at)}</td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{clinic.plano || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${clinic.ativo === false ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {clinic.ativo === false ? 'Inativa' : 'Ativa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {clinic.clinic_users?.length || 0}
                        {clinic.clinic_users && clinic.clinic_users.length > 0 && (
                          <span className="text-xs text-gray-500"> • {clinic.clinic_users.filter((u: any) => u.ativo !== false).length} ativos</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{clinic.bank_accounts?.length || 0}</td>
                      <td className="px-6 py-4 text-gray-600">{clinic.categories?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'clinics' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Building2 size={18}/> Clínicas</h2>
              <p className="text-sm text-gray-500">Gestão completa das clínicas</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openCreateClinicModal}
                className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg border border-brand-600 hover:bg-brand-700"
              >
                + Nova Clínica
              </button>
              <button
                onClick={() => handleToggleClinics(selectedClinics, true)}
                className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100"
              >
                Ativar selecionadas
              </button>
              <button
                onClick={() => handleToggleClinics(selectedClinics, false)}
                className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-100"
              >
                Desativar selecionadas
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar clínica por nome..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="todas">Todas</option>
                <option value="ativas">Ativas</option>
                <option value="inativas">Inativas</option>
              </select>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setClinicViewMode('list')}
                className={`px-3 py-2 text-xs font-medium flex items-center gap-2 ${clinicViewMode === 'list' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                aria-pressed={clinicViewMode === 'list'}
              >
                <List size={14} /> Lista
              </button>
              <button
                type="button"
                onClick={() => setClinicViewMode('boxes')}
                className={`px-3 py-2 text-xs font-medium flex items-center gap-2 ${clinicViewMode === 'boxes' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                aria-pressed={clinicViewMode === 'boxes'}
              >
                <LayoutGrid size={14} /> Boxes
              </button>
            </div>
          </div>

          {clinicViewMode === 'list' ? (
            <div className="border border-gray-100 rounded-lg divide-y">
              {loading && (
                <div className="p-4 text-sm text-gray-400 text-center">Carregando...</div>
              )}
              {!loading && filteredClinics.map(clinic => {
                const selected = selectedClinics.includes(clinic.id);
                return (
                  <div key={clinic.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selected} onChange={e => {
                        if (e.target.checked) setSelectedClinics(prev => [...prev, clinic.id]);
                        else setSelectedClinics(prev => prev.filter(id => id !== clinic.id));
                      }} />
                      <div className="h-[150px] w-[150px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                        {clinic.logo_url ? (
                          <img src={clinic.logo_url} alt={`Logo de ${clinic.name || 'clínica'}`} className="h-full w-full object-cover object-center" />
                        ) : (
                          <span>{getClinicInitials(clinic.name || '')}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          <span className="text-xs text-gray-500">ID: {clinic.id}</span>{' '}
                          {clinic.name}{' '}
                          {!clinic.ativo && <span className="text-xs text-red-600">(inativa)</span>}
                        </p>
                        <p className="text-xs text-gray-500">Pacote: {clinic.plano || '—'}</p>
                        <p className="text-xs text-gray-500">Contato: {clinic.responsavel_nome || '-'} • {clinic.email_contato || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSystemAdmin && (
                        <button
                          onClick={() => {
                            setSelectedClinicId(clinic.id);
                            navigate('/');
                          }}
                          className="text-sm text-emerald-600"
                        >
                          Acessar
                        </button>
                      )}
                      <button
                        onClick={() => handleResendClinicAccess(clinic)}
                        disabled={resendingAccessId === clinic.id}
                        className="text-sm text-sky-600 disabled:opacity-50"
                      >
                        {resendingAccessId === clinic.id ? 'Enviando...' : 'Reenviar acesso'}
                      </button>
                      <button
                        onClick={() => openEditClinicModal(clinic)}
                        className="text-sm text-brand-600"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClinic(clinic)}
                        className="text-sm text-red-600"
                      >
                        Excluir
                      </button>
                      <span className={`px-2 py-1 text-xs rounded-full ${clinic.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {clinic.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                      {isSystemAdmin && selectedClinicId === clinic.id && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700">
                          Em uso
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!loading && filteredClinics.length === 0 && (
                <div className="p-4 text-sm text-gray-400 text-center">Nenhuma clínica cadastrada.</div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading && (
                <div className="col-span-full p-4 text-sm text-gray-400 text-center">Carregando...</div>
              )}
              {!loading && filteredClinics.map(clinic => {
                const selected = selectedClinics.includes(clinic.id);
                return (
                  <div key={clinic.id} className="border border-gray-100 rounded-lg p-4 bg-white flex flex-col gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selected} onChange={e => {
                        if (e.target.checked) setSelectedClinics(prev => [...prev, clinic.id]);
                        else setSelectedClinics(prev => prev.filter(id => id !== clinic.id));
                      }} />
                      <div className="h-20 w-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                        {clinic.logo_url ? (
                          <img src={clinic.logo_url} alt={`Logo de ${clinic.name || 'clínica'}`} className="h-full w-full object-cover object-center" />
                        ) : (
                          <span>{getClinicInitials(clinic.name || '')}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{clinic.name}</p>
                        <p className="text-xs text-gray-500 break-all">ID: {clinic.id}</p>
                        <p className="text-xs text-gray-500">Pacote: {clinic.plano || '—'}</p>
                        <p className="text-xs text-gray-500">Contato: {clinic.responsavel_nome || '-'} • {clinic.email_contato || '-'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-full ${clinic.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {clinic.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                      {!clinic.ativo && <span className="text-xs text-red-600">(inativa)</span>}
                      {isSystemAdmin && selectedClinicId === clinic.id && (
                        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                          Em uso
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {isSystemAdmin && (
                        <button
                          onClick={() => {
                            setSelectedClinicId(clinic.id);
                            navigate('/');
                          }}
                          className="text-sm text-emerald-600"
                        >
                          Acessar
                        </button>
                      )}
                      <button
                        onClick={() => handleResendClinicAccess(clinic)}
                        disabled={resendingAccessId === clinic.id}
                        className="text-sm text-sky-600 disabled:opacity-50"
                      >
                        {resendingAccessId === clinic.id ? 'Enviando...' : 'Reenviar acesso'}
                      </button>
                      <button
                        onClick={() => openEditClinicModal(clinic)}
                        className="text-sm text-brand-600"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClinic(clinic)}
                        className="text-sm text-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && filteredClinics.length === 0 && (
                <div className="col-span-full p-4 text-sm text-gray-400 text-center">Nenhuma clínica cadastrada.</div>
              )}
            </div>
          )}

          {showClinicModal && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={clinicModalControls.onBackdropClick}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-auto space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Editar clínica</h4>
                  <button
                    type="button"
                    onClick={closeClinicModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleUpdateClinic} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Clínica</label>
                    <input
                      value={editClinicForm.name}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagem da clínica</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="h-[150px] w-[150px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                        {editClinicLogoPreview || editClinicForm.logo_url ? (
                          <img
                            src={editClinicLogoPreview || editClinicForm.logo_url || ''}
                            alt="Imagem da clínica"
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <span>{getClinicInitials(editClinicForm.name || '')}</span>
                        )}
                      </div>
                      <label className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        {editClinicLogoPreview || editClinicForm.logo_url ? 'Trocar imagem' : 'Adicionar imagem'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await handleEditClinicLogoChange(file);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <span className="text-xs text-gray-500">Quadrada até 350 x 350.</span>
                    </div>
                    {editClinicLogoError && <p className="text-xs text-red-600 mt-1">{editClinicLogoError}</p>}
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                    <input
                      value={editClinicForm.responsavel_nome}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, responsavel_nome: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
                    <input
                      value={editClinicForm.documento}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, documento: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      value={editClinicForm.email_contato}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, email_contato: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      value={editClinicForm.telefone_contato}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, telefone_contato: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pacote</label>
                    <select
                      value={editClinicForm.package_id}
                      onChange={e => setEditClinicForm(prev => ({ ...prev, package_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                    >
                      <option value="">Selecione...</option>
                      {packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name || 'Sem nome'}</option>
                      ))}
                    </select>
                    </div>
                    <div className="md:col-span-3 border-t border-gray-100 pt-4">
                      <div className="flex flex-col gap-1 mb-3">
                        <h3 className="text-sm font-semibold text-gray-800">Contrato Comercial</h3>
                        <p className="text-xs text-gray-500">Edite os dados comerciais vinculados à clínica.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Produto comprado</label>
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={editContractProductInput}
                              onChange={(e) => setEditContractProductInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                addCommercialProduct(editContractProductInput, 'edit');
                              }}
                              list="commercial-products-edit"
                              placeholder="Digite e pressione Enter"
                              className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => addCommercialProduct(editContractProductInput, 'edit')}
                              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                            >
                              Adicionar
                            </button>
                          </div>
                          <datalist id="commercial-products-edit">
                            {COMMERCIAL_PRODUCT_OPTIONS.map((option) => (
                              <option key={option} value={option} />
                            ))}
                          </datalist>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {editClinicForm.commercial_products.map((product) => (
                              <button
                                key={product}
                                type="button"
                                onClick={() => removeCommercialProduct(product, 'edit')}
                                className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
                              >
                                {product} ✕
                              </button>
                            ))}
                            {!editClinicForm.commercial_products.length && (
                              <span className="text-xs text-gray-400">Nenhum produto selecionado.</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {COMMERCIAL_PRODUCT_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => addCommercialProduct(option, 'edit')}
                                className="px-2 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-gray-300"
                              >
                                + {option}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pacote comprado</label>
                          <select
                            value={editClinicForm.commercial_package_id}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_package_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="">Selecione...</option>
                            {packages.map(pkg => (
                              <option key={pkg.id} value={pkg.id}>{pkg.name || 'Sem nome'}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                          <input
                            value={editClinicForm.commercial_amount}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_amount: e.target.value }))}
                            placeholder="0,00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Início do contrato</label>
                          <input
                            type="date"
                            value={editClinicForm.commercial_start_date}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_start_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Término do contrato</label>
                          <input
                            type="date"
                            value={editClinicForm.commercial_end_date}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_end_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status do contrato</label>
                          <select
                            value={editClinicForm.commercial_status}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="ativo">Ativo</option>
                            <option value="vencendo">Vencendo</option>
                            <option value="encerrado">Encerrado</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Responsável interno</label>
                          <select
                            value={editClinicForm.commercial_owner_user_id}
                            onChange={(e) => setEditClinicForm((prev) => ({ ...prev, commercial_owner_user_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="">Selecione...</option>
                            {internalUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name || user.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editClinicForm.ativo}
                        onChange={e => setEditClinicForm(prev => ({ ...prev, ativo: e.target.checked }))}
                        className="h-4 w-4 text-brand-600 border-gray-300 rounded"
                      />
                      Ativa
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowClinicModal(false);
                        resetEditClinicForm();
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingClinic}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
                    >
                      {savingClinic ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Salvar alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showCreateClinicModal && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={createClinicModalControls.onBackdropClick}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-auto space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Nova clínica</h4>
                  <button
                    type="button"
                    onClick={closeCreateClinicModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateClinic} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Clínica</label>
                    <input
                      value={clinicForm.name}
                      onChange={e => setClinicForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagem da clínica</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="h-[150px] w-[150px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                        {clinicLogoPreview || clinicForm.logo_url ? (
                          <img
                            src={clinicLogoPreview || clinicForm.logo_url || ''}
                            alt="Imagem da clínica"
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <span>{getClinicInitials(clinicForm.name || '')}</span>
                        )}
                      </div>
                      <label className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        {clinicLogoPreview || clinicForm.logo_url ? 'Trocar imagem' : 'Adicionar imagem'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await handleClinicLogoChange(file);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <span className="text-xs text-gray-500">Quadrada até 350 x 350.</span>
                    </div>
                    {clinicLogoError && <p className="text-xs text-red-600 mt-1">{clinicLogoError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                    <input
                      value={clinicForm.responsavel_nome}
                      onChange={e => setClinicForm(prev => ({ ...prev, responsavel_nome: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
                    <input
                      value={clinicForm.documento}
                      onChange={e => setClinicForm(prev => ({ ...prev, documento: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      value={clinicForm.email_contato}
                      onChange={e => setClinicForm(prev => ({ ...prev, email_contato: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      value={clinicForm.telefone_contato}
                      onChange={e => setClinicForm(prev => ({ ...prev, telefone_contato: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pacote</label>
                    <select
                      value={clinicForm.package_id}
                      onChange={e => setClinicForm(prev => ({ ...prev, package_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                    >
                      <option value="">Selecione...</option>
                      {packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name || 'Sem nome'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3 border-t border-gray-100 pt-4">
                    <div className="flex flex-col gap-1 mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">Contrato Comercial</h3>
                      <p className="text-xs text-gray-500">Preencha os dados comerciais que alimentam o Relatório Gerencial.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Produto comprado</label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={contractProductInput}
                            onChange={(e) => setContractProductInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              addCommercialProduct(contractProductInput, 'create');
                            }}
                            list="commercial-products-create"
                            placeholder="Digite e pressione Enter"
                            className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => addCommercialProduct(contractProductInput, 'create')}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                          >
                            Adicionar
                          </button>
                        </div>
                        <datalist id="commercial-products-create">
                          {COMMERCIAL_PRODUCT_OPTIONS.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {clinicForm.commercial_products.map((product) => (
                            <button
                              key={product}
                              type="button"
                              onClick={() => removeCommercialProduct(product, 'create')}
                              className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
                            >
                              {product} ✕
                            </button>
                          ))}
                          {!clinicForm.commercial_products.length && (
                            <span className="text-xs text-gray-400">Nenhum produto selecionado.</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {COMMERCIAL_PRODUCT_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => addCommercialProduct(option, 'create')}
                              className="px-2 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-gray-300"
                            >
                              + {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pacote comprado</label>
                        <select
                          value={clinicForm.commercial_package_id}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_package_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="">Selecione...</option>
                          {packages.map(pkg => (
                            <option key={pkg.id} value={pkg.id}>{pkg.name || 'Sem nome'}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                        <input
                          value={clinicForm.commercial_amount}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_amount: e.target.value }))}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Início do contrato</label>
                        <input
                          type="date"
                          value={clinicForm.commercial_start_date}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_start_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Término do contrato</label>
                        <input
                          type="date"
                          value={clinicForm.commercial_end_date}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_end_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status do contrato</label>
                        <select
                          value={clinicForm.commercial_status}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_status: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="ativo">Ativo</option>
                          <option value="vencendo">Vencendo</option>
                          <option value="encerrado">Encerrado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável interno</label>
                        <select
                          value={clinicForm.commercial_owner_user_id}
                          onChange={(e) => setClinicForm((prev) => ({ ...prev, commercial_owner_user_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="">Selecione...</option>
                          {internalUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 md:col-span-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={clinicForm.ativo} onChange={e => setClinicForm(prev => ({ ...prev, ativo: e.target.checked }))} className="h-4 w-4 text-brand-600 border-gray-300 rounded" />
                      Ativa
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={closeCreateClinicModal}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button type="submit" disabled={savingClinic} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center">
                        {savingClinic ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2"><CheckSquare size={16}/> Usuários da Clínica</h3>
            <div className="flex gap-2">
              <button onClick={() => supabase.from('clinic_users').update({ ativo: true }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])))} className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">Ativar</button>
              <button onClick={() => supabase.from('clinic_users').update({ ativo: false }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])))} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-100">Desativar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">Convidar usuário</h4>
                  <p className="text-xs text-gray-500">Gere um convite por e-mail (role: owner/admin/user)</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@dominio.com"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <select
                    value={inviteForm.clinic_id}
                    onChange={e => setInviteForm(prev => ({ ...prev, clinic_id: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Clínica...</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="user">Usuário</option>
                  </select>
                  <button
                    type="button"
                    disabled={sendingInvite || !invitesEnabled}
                    onClick={async () => {
                      if (!invitesEnabled) {
                        alert('Convites indisponíveis: tabela clinic_invites não encontrada no Supabase.');
                        return;
                      }
                      if (!inviteForm.email || !inviteForm.clinic_id) {
                        alert('Informe e-mail e clínica');
                        return;
                      }
                      const inviteEmail = inviteForm.email.trim().toLowerCase();
                      const { data: existingInviteUser } = await supabase
                        .from('clinic_users')
                        .select('id')
                        .eq('email', inviteEmail)
                        .maybeSingle();
                      if (existingInviteUser) {
                        alert('Já existe um usuário com este e-mail em outra clínica. Use um e-mail diferente.');
                        return;
                      }
                      setSendingInvite(true);
                      try {
                        const token = crypto.randomUUID();
                        const expires_at = new Date(Date.now() + 7*24*60*60*1000).toISOString();
                        const { error, data } = await (supabase as any)
                          .from('clinic_invites')
                          .insert([{
                            clinic_id: inviteForm.clinic_id,
                            email: inviteEmail,
                            role: inviteForm.role,
                            token,
                            invited_by: currentUserId,
                            expires_at
                          }])
                          .select()
                          .single();
                        if (error) throw error;
                        const redirectTo = callbackUrl
                          ? `${callbackUrl}?redirectTo=${encodeURIComponent(`/accept-invite?token=${data.token}`)}`
                          : undefined;
                        const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = { shouldCreateUser: true };
                        if (redirectTo) otpOptions.emailRedirectTo = redirectTo;
                        const { error: inviteEmailError } = await supabase.auth.signInWithOtp({
                          email: inviteEmail,
                          options: otpOptions,
                        });
                        if (inviteEmailError) {
                          alert(`Convite gerado, mas não foi possível enviar o email: ${inviteEmailError.message}. Link: /accept-invite?token=${data.token}`);
                        } else {
                          alert(`Convite enviado por email. Se necessário, use o link /accept-invite?token=${data.token}`);
                        }
                        const { data: inv } = await (supabase as any).from('clinic_invites').select('*').order('created_at', { ascending: false });
                        if (inv) setInvites(inv as any[]);
                        setInviteForm({ clinic_id: '', email: '', role: 'user' });
                      } catch (err: any) {
                        alert('Erro ao enviar convite: ' + err.message);
                      } finally {
                        setSendingInvite(false);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm ${invitesEnabled ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                  >
                    {invitesEnabled ? (sendingInvite ? 'Enviando...' : 'Enviar convite') : 'Convites indisponíveis'}
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 border border-gray-200">
                    <tr>
                      <th className="px-3 py-2">E-mail</th>
                      <th className="px-3 py-2">Clínica</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Expira</th>
                      <th className="px-3 py-2">Token</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invitesEnabled ? (
                      invites.map((i) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 text-gray-800">{i.email}</td>
                          <td className="px-3 py-2 text-gray-600">{i.clinic_id}</td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{i.role}</td>
                          <td className="px-3 py-2 text-gray-600">{formatDate(i.expires_at)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 break-all">{i.token}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={async () => {
                                if (!confirm('Revogar convite?')) return;
                                const { error } = await (supabase as any).from('clinic_invites').delete().eq('id', i.id);
                                if (error) { alert(error.message); return; }
                                setInvites(prev => prev.filter(p => p.id !== i.id));
                              }}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Revogar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">Convites indisponíveis (tabela clinic_invites ausente).</td></tr>
                    )}
                    {invitesEnabled && invites.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">Nenhum convite pendente.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
              <select
                value={userForm.clinic_id}
                onChange={e => setUserForm({ ...userForm, clinic_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="">Selecione...</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome do usuário"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="email@dominio.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel/Acesso</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="user">Usuário</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={userForm.ativo} onChange={e => setUserForm(prev => ({ ...prev, ativo: e.target.checked }))} className="h-4 w-4 text-brand-600 border-gray-300 rounded" />
                Ativo
              </label>
              <button
                type="button"
                onClick={handleCreateUser}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {savingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Adicionar
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar usuário por nome..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 flex-1"
            />
            <button
              onClick={() => {
                supabase.from('clinic_users').update({
                  role: bulkUserRole,
                }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])));
              }}
              className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              Aplicar papel
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aplicar papel aos selecionados</label>
              <select
                value={bulkUserRole}
                onChange={e => setBulkUserRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="user">Usuário</option>
              </select>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg divide-y">
            {clinicUsers
              .filter((u: any) => u.name?.toLowerCase().includes(userSearch.toLowerCase()))
              .map(u => {
                const selected = selectedUsers.includes(u.id);
                return (
                  <div key={u.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers(prev => [...prev, u.id]);
                          else setSelectedUsers(prev => prev.filter(id => id !== u.id));
                        }}
                      />
                      <div>
                        <p className="font-semibold text-gray-800">{u.name} <span className="text-xs text-gray-500">({u.role || 'user'})</span></p>
                        <p className="text-xs text-gray-500">{u.email} • Clínica: {u.clinic_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditUserModal(u)}
                        className="text-sm text-brand-600"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="text-sm text-red-600"
                      >
                        Excluir
                      </button>
                      <span className={`px-2 py-1 text-xs rounded-full ${u.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            {clinicUsers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum usuário cadastrado.</div>
            )}
          </div>

          {showUserModal && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={userModalControls.onBackdropClick}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Editar usuário</h4>
                  <button
                    type="button"
                    onClick={closeUserModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
                      <select
                        value={editUserForm.clinic_id}
                        onChange={e => setEditUserForm({ ...editUserForm, clinic_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {clinics.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <input
                        value={editUserForm.name}
                        onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        placeholder="Nome do usuário"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                      <input
                        type="email"
                        value={editUserForm.email}
                        onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        placeholder="email@dominio.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Papel/Acesso</label>
                      <select
                        value={editUserForm.role}
                        onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="user">Usuário</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="edit-user-active"
                        type="checkbox"
                        checked={editUserForm.ativo}
                        onChange={(e) => setEditUserForm({ ...editUserForm, ativo: e.target.checked })}
                        className="h-4 w-4 text-brand-600 border-gray-300 rounded"
                      />
                      <label htmlFor="edit-user-active" className="text-sm text-gray-700">Ativo</label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserModal(false);
                        setEditingUserId(null);
                        setEditUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Salvar alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Admin;
