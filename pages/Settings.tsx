import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Loader2, CreditCard, User, Upload, Download, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildPublicUrl, formatDate } from '../lib/utils';
import { Category } from '../types';
import { useAuth } from '../src/auth/AuthProvider';
import { useSearchParams } from 'react-router-dom';
import { useModalControls } from '../hooks/useModalControls';

type Section = 'geral' | 'categorias' | 'taxas' | 'clientes' | 'profissionais' | 'fornecedores' | 'usuarios';

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

const decodeCsvFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const cleanedUtf8 = utf8.replace(/^\uFEFF/, '');
  if (cleanedUtf8.includes('\uFFFD')) {
    const latin = new TextDecoder('windows-1252', { fatal: false }).decode(buffer);
    return latin.replace(/^\uFEFF/, '');
  }
  return cleanedUtf8;
};

const parseCsvText = (text: string) => {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) throw new Error('Arquivo vazio');
  const separator = detectCsvSeparator(lines[0]);
  const parseLine = (line: string) => parseCsvLine(line, separator);
  const header = parseLine(lines[0]).map((value) => value.toLowerCase());
  return { lines, header, parseLine };
};

const normalizeAction = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (['c', 'create', 'criar', 'novo', 'adicionar', 'inserir'].includes(raw)) return 'create';
  if (['u', 'update', 'atualizar', 'editar', 'edit'].includes(raw)) return 'update';
  if (['d', 'delete', 'apagar', 'remover', 'excluir'].includes(raw)) return 'delete';
  return null;
};

const PRESET_REVENUE_CATEGORIES = [
  'ACERTOS',
  'ALUGUEL',
  'ANTECIPACAO DE RECEITA',
  'AVALIAÇÃO',
  'BIOESTIMULADOR',
  'BIOPSIA',
  'BRINDES',
  'CAPILAR',
  'CIRÚRGICO',
  'CONSULTA',
  'CORPORAL',
  'DRUG DELIVERY',
  'ESTETICA',
  'EXECUCAO POS PROCEDIMENTO',
  'FAMILIA',
  'FELLOW',
  'FIOS',
  'GIFT CARD',
  'INJETÁVEL',
  'INJETÁVEL CORPORAL',
  'INJETÁVEL FACIAL',
  'INTRADERMOTERAPIA CAPILAR',
  'LOCACAO',
  'LOCACAO DE EQUIPAMENTO',
  'MMP',
  'PEELING',
  'PEQUENA CIRURGIA',
  'PROCED GINECOLOGICO',
  'PRODUTOS',
  'REMODELADOR',
  'RETORNO',
  'SERINGA DE PREENCHIMENTO',
  'SKINBOOSTER',
  'SOROTERAPIA',
  'TECNOLOGIA CORPORAL',
  'TECNOLOGIA FACIAL',
  'TRATAMENTO',
  'TREINAMENTO',
  'WORKSHOP',
];

const PRESET_EXPENSE_CATEGORIES = [
  'ALIMENTACAO',
  'COMISSÃO PARCEIROS',
  'CONFRATERNIZAÇÃO',
  'CONSULTORIA',
  'CONSUMIVEL EQUIPAMENTOS',
  'CURSOS E TREINAMENTOS',
  'CUSTO FINANCEIROS',
  'DESPESAS ADMINISTRATIVAS',
  'DESPESAS COM PACIENTES',
  'DISTRIBUIÇÃO LUCRO',
  'ESTRUTURA / LOGISTICA',
  'FORMULAS MANIPULADAS',
  'FRETE',
  'IMPOSTOS',
  'INSUMOS',
  'INSUMOS/PRODUTOS',
  'INVESTIMENTOS',
  'MANUTENÇÃO CLINICA',
  'MANUTENÇÃO EQUIPAMENTOS',
  'MARKETING',
  'MATERIAIS GERAIS',
  'MATERIAIS UTILIZADO EM PROCEDIMENTOS',
  'MEDICAMENTOS',
  'PRESTADOR DE SERVIÇO',
  'PRO LABORE',
  'RECURSOS HUMANOS',
  'REPASSES FINANCEIROS',
];

const normalizeCategoryName = (value: string) => value.trim().toLowerCase();

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

const getUserInitials = (name: string, email: string) => {
  const rawName = name.trim();
  if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  const rawEmail = email.trim();
  if (rawEmail) return rawEmail.slice(0, 2).toUpperCase();
  return 'US';
};

const Settings: React.FC = () => {
  const [section, setSection] = useState<Section>('geral');
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'receita' | 'despesa'>('receita');
  const [selectedRevenueCategories, setSelectedRevenueCategories] = useState<string[]>([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const { effectiveClinicId: clinicId, isAdmin, clinic, role } = useAuth();

  const PAGE_OPTIONS = [
    { value: '/', label: 'Dash Financeiro' },
    { value: '/reports/attendance', label: 'Relatório de Atendimento' },
    { value: '/incomes', label: 'Receitas' },
    { value: '/expenses', label: 'Despesas' },
    { value: '/card-analysis', label: 'Análise de cartão' },
    { value: '/reconciliation', label: 'Conciliação bancária' },
    { value: '/assistant', label: 'Assistente AI' },
    { value: '/profile', label: 'Meu perfil' },
    { value: '/contents/courses', label: 'Conteúdos • Cursos' },
    { value: '/contents/trainings', label: 'Conteúdos • Treinamentos' },
    { value: '/accounts', label: 'Contas bancárias' },
    { value: '/settings', label: 'Minha Clínica' },
    { value: '/settings?section=geral', label: 'Minha Clínica • Informações gerais' },
    { value: '/settings?section=categorias', label: 'Minha Clínica • Categorias' },
    { value: '/settings?section=taxas', label: 'Minha Clínica • Taxas' },
    { value: '/settings?section=clientes', label: 'Minha Clínica • Clientes' },
    { value: '/settings?section=profissionais', label: 'Minha Clínica • Profissionais' },
    { value: '/settings?section=fornecedores', label: 'Minha Clínica • Fornecedores' },
    { value: '/settings?section=usuarios', label: 'Minha Clínica • Usuários' },
    { value: '/commercial/dashboard', label: 'Comercial • Dash comercial' },
    { value: '/commercial/ranking', label: 'Comercial • Ranking dos clientes' },
    { value: '/commercial/recurrence', label: 'Comercial • Recorrência' },
    { value: '/commercial/geo', label: 'Comercial • Geolocalização' },
    { value: '/pricing/calculator', label: 'Precificação • Calculadora' },
    { value: '/pricing/procedures', label: 'Precificação • Procedimentos' },
    { value: '/pricing/expenses', label: 'Precificação • Gastos' },
    { value: '/pricing/focus-matrix', label: 'Precificação • Matriz de Foco' },
    { value: '/hr/departments', label: 'Minha Clínica • Departamentos' },
    { value: '/hr/collaborators', label: 'Minha Clínica • Colaboradores' },
    { value: '/hr/feedback', label: 'Recursos Humanos • Feedback' },
    { value: '/hr/meetings', label: 'Recursos Humanos • Reuniões' },
    { value: '/app/agenda', label: 'Recursos Humanos • Agenda' },
    { value: '/hr/archetypes', label: 'Recursos Humanos • Arquétipos' },
    { value: '/hr/values', label: 'Recursos Humanos • Teoria de valores' },
    { value: '/analytics/perfil', label: 'Analytics • Perfil comportamental' },
  ];
  const PAGE_LABEL_MAP = useMemo(() => Object.fromEntries(PAGE_OPTIONS.map((p) => [p.value, p.label])), []);
  const revenuePresetMap = useMemo(
    () => new Map(PRESET_REVENUE_CATEGORIES.map((name) => [normalizeCategoryName(name), name])),
    []
  );
  const expensePresetMap = useMemo(
    () => new Map(PRESET_EXPENSE_CATEGORIES.map((name) => [normalizeCategoryName(name), name])),
    []
  );

  // Form State - Taxas
  const [cardFees, setCardFees] = useState<any[]>([]);
  const [feeForm, setFeeForm] = useState({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
  const [addingFee, setAddingFee] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);

  // Form State - Clientes
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerForm, setCustomerForm] = useState({ name: '', cpf: '', cep: '' });
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerImporting, setCustomerImporting] = useState(false);
  const [customerImportReport, setCustomerImportReport] = useState<{ imported: number; rejected: { name: string; cpf: string; cep: string; reason: string; }[] } | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({ name: '', cpf: '', cep: '' });
  const customerPageSize = 10;

  // Form State - Clínicas

  // Profissionais
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [professionalForm, setProfessionalForm] = useState({ nome: '', tipo: 'venda' });
  const [editingProfessionalId, setEditingProfessionalId] = useState<string | null>(null);
  const [savingProfessional, setSavingProfessional] = useState(false);

  // Fornecedores
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierForm, setSupplierForm] = useState({ nome: '', cnpj: '', telefone: '' });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierImporting, setSupplierImporting] = useState(false);

  // Usuários da clínica
  const [clinicUsers, setClinicUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'user',
    ativo: true,
    paginas_liberadas: [] as string[],
    avatar_url: null as string | null,
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [userAvatarFile, setUserAvatarFile] = useState<File | null>(null);
  const [userAvatarPreview, setUserAvatarPreview] = useState<string | null>(null);
  const [userAvatarError, setUserAvatarError] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setEditingCustomerId(null);
    setCustomerError(null);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    resetEditUserForm();
  };

  const customerModalControls = useModalControls({
    isOpen: showCustomerModal,
    onClose: closeCustomerModal,
  });

  const userModalControls = useModalControls({
    isOpen: showUserModal,
    onClose: closeUserModal,
  });
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: 'user',
    ativo: true,
    paginas_liberadas: [] as string[],
    avatar_url: null as string | null,
  });
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [editUserAvatarFile, setEditUserAvatarFile] = useState<File | null>(null);
  const [editUserAvatarPreview, setEditUserAvatarPreview] = useState<string | null>(null);
  const [editUserAvatarError, setEditUserAvatarError] = useState<string | null>(null);
  const pageMenuRef = useRef<HTMLDetailsElement | null>(null);
  const editPageMenuRef = useRef<HTMLDetailsElement | null>(null);

  const onlyDigits = (value: string) => value.replace(/\D/g, '');
  const GEO_TIMEOUT_MS = 4500;

  const geocodeCep = async (cep: string, timeoutMs = GEO_TIMEOUT_MS) => {
    const cleaned = onlyDigits(cep);
    if (cleaned.length !== 8) return null;
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleaned)}&country=Brazil&format=json&limit=1`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data[0]) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  };

  const saveCustomerGeo = async (customerId: string, cep: string | null) => {
    if (!customerId) return;
    if (!cep) {
      await supabase.from('customers').update({ lat: null, lng: null }).eq('id', customerId);
      return;
    }
    const geo = await geocodeCep(cep);
    if (!geo) return;
    await supabase.from('customers').update({ lat: geo.lat, lng: geo.lng }).eq('id', customerId);
  };

  const geocodeCustomersInBackground = async (rows: Array<{ id: string; cep: string | null }>) => {
    const queue = rows
      .map((row) => ({ id: row.id, cep: row.cep ? onlyDigits(row.cep) : '' }))
      .filter((row) => row.cep.length === 8);
    if (!queue.length) return;
    const concurrency = 4;
    const pending = [...queue];
    await Promise.all(
      Array.from({ length: concurrency }).map(async () => {
        while (pending.length) {
          const row = pending.shift();
          if (!row) return;
          const geo = await geocodeCep(row.cep);
          if (!geo) continue;
          await supabase.from('customers').update({ lat: geo.lat, lng: geo.lng }).eq('id', row.id);
        }
      })
    );
  };

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
      return clinicPages.includes(option.value);
    });
  }, [clinicPages, PAGE_OPTIONS]);

  const availablePageSet = useMemo(() => new Set(availablePageOptions.map((p) => p.value)), [availablePageOptions]);
  const isClinicOwner = role === 'owner';
  const resetRedirectUrl = buildPublicUrl('/auth/reset');

  useEffect(() => {
    return () => {
      if (userAvatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(userAvatarPreview);
      }
    };
  }, [userAvatarPreview]);

  useEffect(() => {
    return () => {
      if (editUserAvatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(editUserAvatarPreview);
      }
    };
  }, [editUserAvatarPreview]);

  const isValidCPF = (cpf: string) => {
    const str = onlyDigits(cpf);
    if (str.length !== 11 || /^(\d)\1+$/.test(str)) return false;
    const calc = (base: number) => {
      let sum = 0;
      for (let i = 0; i < base; i++) sum += parseInt(str[i], 10) * (base + 1 - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };
    return calc(9) === parseInt(str[9], 10) && calc(10) === parseInt(str[10], 10);
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      let query = supabase.from('categories').select('*').order('name');
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query;
      
      if (error) throw error;
      const nextCategories = (data as any) || [];
      setCategories(nextCategories);
      const revenueSelected = new Set<string>();
      const expenseSelected = new Set<string>();
      nextCategories.forEach((cat: any) => {
        const normalized = normalizeCategoryName(cat.name || '');
        if (cat.tipo === 'receita' && revenuePresetMap.has(normalized)) {
          revenueSelected.add(revenuePresetMap.get(normalized) as string);
        }
        if (cat.tipo === 'despesa' && expensePresetMap.has(normalized)) {
          expenseSelected.add(expensePresetMap.get(normalized) as string);
        }
      });
      setSelectedRevenueCategories(Array.from(revenueSelected));
      setSelectedExpenseCategories(Array.from(expenseSelected));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCardFees = async () => {
    let query = supabase.from('card_fees').select('*').order('created_at', { ascending: false });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setCardFees(data as any[]);
  };

  const fetchCustomers = async () => {
    let query = supabase.from('customers').select('*').order('name', { ascending: true });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setCustomers(data as any[]);
  };

  const fetchProfessionals = async () => {
    let query = supabase.from('professionals').select('*').order('created_at', { ascending: false });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setProfessionals(data as any[]);
  };

  const fetchSuppliers = async () => {
    let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (!error && data) setSuppliers(data as any[]);
  };

  const fetchClinicUsers = async () => {
    if (!clinicId) {
      setClinicUsers([]);
      return;
    }
    setUsersLoading(true);
    const { data, error } = await supabase
      .from('clinic_users')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) setClinicUsers(data as any[]);
    setUsersLoading(false);
  };

  // Sincronizar seção com querystring
  useEffect(() => {
    const s = searchParams.get('section') as Section | null;
    if (s && ['geral','categorias','taxas','clientes','profissionais','fornecedores','usuarios'].includes(s)) {
      setSection(s);
    }
  }, [searchParams]);

  useEffect(() => {
    if (section !== 'usuarios') return;
    if (!isClinicOwner) return;
    fetchClinicUsers();
  }, [clinicId, section, isClinicOwner]);

  const setSectionAndUrl = (s: Section) => {
    setSection(s);
    const params = new URLSearchParams(searchParams);
    params.set('section', s);
    setSearchParams(params, { replace: true });
  };

  const handleImportCustomers = async (file: File) => {
    if (!clinicId) {
      alert('Nenhuma clínica ativa encontrada para associar os clientes.');
      return;
    }
    setCustomerImporting(true);
    setCustomerImportReport(null);
    try {
      const text = await decodeCsvFile(file);
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (!lines.length) throw new Error('Arquivo vazio.');

      const first = lines[0];
      const commaCount = (first.match(/,/g) || []).length;
      const semicolonCount = (first.match(/;/g) || []).length;
      const separator = semicolonCount > commaCount ? ';' : ',';

      const parseLine = (line: string) => {
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
        return out.map(s => s.trim());
      };

      const header = parseLine(first).map(h => h.toLowerCase());
      const hasHeader = header.some(h => h.includes('cpf') || h.includes('nome'));
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const findIdx = (needle: string[]) => {
        const idx = header.findIndex(h => needle.some(n => h.includes(n)));
        return idx >= 0 ? idx : -1;
      };
      const idxNome = hasHeader ? findIdx(['nome']) : -1;
      const idxCpf = hasHeader ? findIdx(['cpf']) : -1;
      const idxCep = hasHeader ? findIdx(['cep']) : -1;

      const seen = new Set<string>();
      const rejected: { name: string; cpf: string; cep: string; reason: string }[] = [];
      const candidates: { name: string; cpf: string | null; cep: string | null }[] = [];

      const pick = (cols: string[], idxHeader: number, fallback: number) => {
        const idx = idxHeader >= 0 ? idxHeader : fallback;
        return cols[idx] ?? '';
      };

      dataLines.forEach((line) => {
        const cols = parseLine(line);
        const shift = !hasHeader && cols.length >= 3 ? 0 : 0;
        const name = pick(cols, idxNome, shift + 0);
        const cpfRaw = pick(cols, idxCpf, shift + 1);
        const cepRaw = pick(cols, idxCep, shift + 2);
        const cpf = onlyDigits(cpfRaw);
        const cep = onlyDigits(cepRaw);

        if (!name.trim()) {
          rejected.push({ name, cpf: cpfRaw, cep, reason: 'Nome obrigatório' });
          return;
        }
        if (cpf) {
          if (!isValidCPF(cpf)) {
            rejected.push({ name, cpf: cpfRaw, cep, reason: 'CPF inválido' });
            return;
          }
          if (seen.has(cpf)) {
            rejected.push({ name, cpf: cpfRaw, cep, reason: 'CPF duplicado no arquivo' });
            return;
          }
          seen.add(cpf);
        }
        candidates.push({ name: name.trim(), cpf: cpf || null, cep: cep || null });
      });

      const { data: existing } = await supabase
        .from('customers')
        .select('cpf')
        .eq('clinic_id', clinicId);

      const existingSet = new Set<string>((existing || []).map((c: any) => onlyDigits(c.cpf || '')).filter(Boolean));

      const toInsert = candidates.filter(c => {
        if (c.cpf && existingSet.has(c.cpf)) {
          rejected.push({ name: c.name, cpf: c.cpf, cep: c.cep || '', reason: 'CPF já existe na clínica' });
          return false;
        }
        return true;
      });

      if (toInsert.length) {
        const payload = toInsert.map(c => ({
          name: c.name,
          cpf: c.cpf,
          cep: c.cep || null,
          clinic_id: clinicId,
        }));
        const { data: inserted, error } = await supabase.from('customers').insert(payload).select('id, cep');
        if (error) throw error;
        if (inserted && inserted.length) {
          void geocodeCustomersInBackground(inserted as Array<{ id: string; cep: string | null }>);
        }
      }

      setCustomerImportReport({ imported: toInsert.length, rejected });
      fetchCustomers();
    } catch (err: any) {
      alert('Erro ao importar clientes: ' + err.message);
    } finally {
      setCustomerImporting(false);
    }
  };

  useEffect(() => {
    if (!clinicId) return;
    fetchCategories();
    fetchCardFees();
    fetchCustomers();
    fetchProfessionals();
    fetchSuppliers();
  }, [clinicId]);


  const sortByPreset = (values: string[], preset: string[]) => {
    const set = new Set(values.map(normalizeCategoryName));
    return preset.filter((name) => set.has(normalizeCategoryName(name)));
  };

  const toggleCategorySelection = (name: string) => {
    if (activeTab === 'receita') {
      setSelectedRevenueCategories((prev) => {
        const normalized = normalizeCategoryName(name);
        const exists = prev.some((item) => normalizeCategoryName(item) === normalized);
        const next = exists ? prev.filter((item) => normalizeCategoryName(item) !== normalized) : [...prev, name];
        return sortByPreset(next, PRESET_REVENUE_CATEGORIES);
      });
      return;
    }
    setSelectedExpenseCategories((prev) => {
      const normalized = normalizeCategoryName(name);
      const exists = prev.some((item) => normalizeCategoryName(item) === normalized);
      const next = exists ? prev.filter((item) => normalizeCategoryName(item) !== normalized) : [...prev, name];
      return sortByPreset(next, PRESET_EXPENSE_CATEGORIES);
    });
  };

  const selectAllCategories = () => {
    if (activeTab === 'receita') {
      setSelectedRevenueCategories([...PRESET_REVENUE_CATEGORIES]);
    } else {
      setSelectedExpenseCategories([...PRESET_EXPENSE_CATEGORIES]);
    }
  };

  const clearAllCategories = () => {
    if (activeTab === 'receita') {
      setSelectedRevenueCategories([]);
    } else {
      setSelectedExpenseCategories([]);
    }
  };

  const saveCategorySelection = async () => {
    if (!clinicId) {
      alert('Nenhuma clínica ativa definida.');
      return;
    }
    setSavingCategories(true);
    try {
      const selected = activeTab === 'receita' ? selectedRevenueCategories : selectedExpenseCategories;
      const selectedSet = new Set(selected.map(normalizeCategoryName));
      const existing = categories.filter((cat) => (cat as any).tipo === activeTab);
      const existingSet = new Set(existing.map((cat) => normalizeCategoryName(cat.name)));
      const toCreate = selected
        .filter((name) => !existingSet.has(normalizeCategoryName(name)))
        .map((name) => ({
          name,
          tipo: activeTab,
          cor_opcional: activeTab === 'receita' ? '#0ea5e9' : '#ef4444',
          clinic_id: clinicId,
        }));
      const toDelete = existing
        .filter((cat) => !selectedSet.has(normalizeCategoryName(cat.name)))
        .map((cat) => cat.id);

      if (toCreate.length) {
        const { error } = await supabase.from('categories').insert(toCreate);
        if (error) throw error;
      }
      if (toDelete.length) {
        const { error } = await supabase.from('categories').delete().in('id', toDelete);
        if (error) throw error;
      }
      await fetchCategories();
      alert('Categorias atualizadas.');
    } catch (error: any) {
      alert('Erro ao salvar categorias: ' + error.message);
    } finally {
      setSavingCategories(false);
    }
  };

  const handleImportSuppliers = async (file: File) => {
    if (!clinicId) {
      alert('Nenhuma clínica ativa definida.');
      return;
    }
    setSupplierImporting(true);
    try {
      const text = await decodeCsvFile(file);
      const { lines, header, parseLine } = parseCsvText(text);
      const hasHeader = header.some((h) =>
        ['acao', 'ação', 'action', 'nome', 'cnpj', 'documento', 'telefone', 'id'].some((needle) => h.includes(needle))
      );
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const findIdx = (needles: string[]) => {
        const idx = header.findIndex((h) => needles.some((needle) => h.includes(needle)));
        return idx >= 0 ? idx : -1;
      };

      const idxAction = hasHeader ? findIdx(['acao', 'ação', 'action']) : -1;
      const idxId = hasHeader ? findIdx(['id']) : -1;
      const idxNome = hasHeader ? findIdx(['nome']) : -1;
      const idxCnpj = hasHeader ? findIdx(['cnpj', 'documento', 'doc']) : -1;
      const idxTelefone = hasHeader ? findIdx(['telefone', 'fone', 'celular']) : -1;
      const fallbackNome = idxNome >= 0 ? idxNome : (idxAction >= 0 || idxId >= 0 ? 2 : 0);
      const fallbackDocumento = idxCnpj >= 0 ? idxCnpj : (idxAction >= 0 || idxId >= 0 ? 3 : 1);
      const fallbackTelefone = idxTelefone >= 0 ? idxTelefone : (idxAction >= 0 || idxId >= 0 ? 4 : 2);
      const fallbackId = idxId >= 0 ? idxId : (idxAction >= 0 ? 1 : -1);

      const toCreate: any[] = [];
      const toUpdate: { id: string; payload: any }[] = [];
      const toDelete: string[] = [];
      const rejected: { line: number; reason: string }[] = [];

      const pick = (cols: string[], idxHeader: number, fallback: number) => {
        const idx = idxHeader >= 0 ? idxHeader : fallback;
        return (cols[idx] ?? '').trim();
      };

      dataLines.forEach((line, index) => {
        const cols = parseLine(line);
        if (cols.every((col) => !col.trim())) return;

        const actionRaw = idxAction >= 0 ? pick(cols, idxAction, 0) : '';
        const id = pick(cols, idxId, fallbackId);
        const nome = pick(cols, idxNome, fallbackNome);
        const cnpjRaw = pick(cols, idxCnpj, fallbackDocumento);
        const telefone = pick(cols, idxTelefone, fallbackTelefone);

        let action = actionRaw ? normalizeAction(actionRaw) : null;
        if (actionRaw && !action) {
          rejected.push({ line: index + 1, reason: 'Ação inválida' });
          return;
        }
        if (!action) action = id ? 'update' : 'create';

        if (action === 'delete') {
          if (!id) {
            rejected.push({ line: index + 1, reason: 'ID obrigatório para apagar' });
            return;
          }
          toDelete.push(id);
          return;
        }

        const cnpj = cnpjRaw ? onlyDigits(cnpjRaw) || cnpjRaw : '';
        if (action === 'create') {
          if (!nome) {
            rejected.push({ line: index + 1, reason: 'Nome obrigatório' });
            return;
          }
          toCreate.push({
            nome,
            cnpj: cnpj || null,
            telefone: telefone || null,
            clinic_id: clinicId,
          });
          return;
        }

        if (!id) {
          rejected.push({ line: index + 1, reason: 'ID obrigatório para atualizar' });
          return;
        }

        const payload: any = {};
        if (nome) payload.nome = nome;
        if (cnpjRaw) payload.cnpj = cnpj || null;
        if (telefone) payload.telefone = telefone || null;
        if (!Object.keys(payload).length) {
          rejected.push({ line: index + 1, reason: 'Nada para atualizar' });
          return;
        }
        toUpdate.push({ id, payload });
      });

      const totalOps = toCreate.length + toUpdate.length + toDelete.length;
      if (!totalOps && rejected.length === 0) {
        alert('Nenhuma linha válida encontrada no CSV.');
        return;
      }

      if (toCreate.length) {
        const { error } = await supabase.from('suppliers').insert(toCreate);
        if (error) throw error;
      }

      if (toUpdate.length) {
        const results = await Promise.all(
          toUpdate.map((item) =>
            supabase.from('suppliers').update(item.payload).eq('id', item.id).eq('clinic_id', clinicId)
          )
        );
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
      }

      if (toDelete.length) {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .in('id', toDelete)
          .eq('clinic_id', clinicId);
        if (error) throw error;
      }

      fetchSuppliers();

      if (totalOps || rejected.length) {
        const msg = [
          `Criados: ${toCreate.length}`,
          `Atualizados: ${toUpdate.length}`,
          `Apagados: ${toDelete.length}`,
          `Rejeitados: ${rejected.length}`,
        ].join(' • ');
        alert(`Importação de fornecedores concluída. ${msg}`);
      }
    } catch (error: any) {
      alert('Erro ao importar fornecedores: ' + error.message);
    } finally {
      setSupplierImporting(false);
    }
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) {
      alert('Nenhuma clínica ativa definida.');
      return;
    }
    if (!feeForm.bandeira.trim()) return;
    const minI = parseInt(feeForm.min_installments || '1', 10) || 1;
    const maxI = parseInt(feeForm.max_installments || '1', 10) || 1;
    if (minI > maxI) {
      alert('Intervalo de parcelas inválido (mínimo maior que máximo).');
      return;
    }
    setAddingFee(true);
    try {
      const percent = parseFloat(feeForm.taxa_percent.replace(',', '.')) || 0;
      if (editingFeeId) {
        const { error } = await supabase.from('card_fees').update({
          bandeira: feeForm.bandeira,
          taxa_percent: percent,
          metodo: feeForm.metodo,
          min_installments: minI,
          max_installments: maxI,
          clinic_id: clinicId
        }).eq('id', editingFeeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('card_fees').insert([{
          bandeira: feeForm.bandeira,
          taxa_percent: percent,
          metodo: feeForm.metodo,
          min_installments: minI,
          max_installments: maxI,
          clinic_id: clinicId
        }]);
        if (error) throw error;
      }
      setFeeForm({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
      setEditingFeeId(null);
      fetchCardFees();
    } catch (err: any) {
      alert('Erro ao salvar taxa: ' + err.message);
    } finally {
      setAddingFee(false);
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!confirm('Excluir taxa?')) return;
    const { error } = await supabase.from('card_fees').delete().eq('id', id);
    if (!error) {
      if (editingFeeId === id) {
        setEditingFeeId(null);
        setFeeForm({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
      }
      fetchCardFees();
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError(null);
    if (!clinicId) {
      setCustomerError('Nenhuma clínica ativa encontrada.');
      return;
    }
    if (!customerForm.name.trim()) return;
    const cpfDigits = onlyDigits(customerForm.cpf);
    const cepDigits = onlyDigits(customerForm.cep);
    if (cpfDigits && !isValidCPF(cpfDigits)) {
      setCustomerError('CPF inválido.');
      return;
    }
    if (cepDigits && cepDigits.length !== 8) {
      setCustomerError('CEP inválido (use 8 dígitos).');
      return;
    }

    // Checar duplicidade de CPF
    if (cpfDigits) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('cpf', cpfDigits)
        .eq('clinic_id', clinicId)
        .maybeSingle();
      if (existing) {
        setCustomerError('CPF já cadastrado.');
        return;
      }
    }

    setAddingCustomer(true);
    try {
      const payload = {
        name: customerForm.name,
        cpf: cpfDigits || null,
        cep: cepDigits || null,
        clinic_id: clinicId
      };
      const { data: inserted, error } = await supabase
        .from('customers')
        .insert([payload])
        .select('id, cep');
      if (error) throw error;
      const row = inserted?.[0];
      if (row?.id) {
        void saveCustomerGeo(row.id, cepDigits || null);
      }
      setCustomerForm({ name: '', cpf: '', cep: '' });
      fetchCustomers();
    } catch (err: any) {
      alert('Erro ao salvar cliente: ' + err.message);
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerId) return;
    setCustomerError(null);
    if (!clinicId) {
      setCustomerError('Nenhuma clínica ativa encontrada.');
      return;
    }
    if (!customerEditForm.name.trim()) return;
    const cpfDigits = onlyDigits(customerEditForm.cpf);
    const cepDigits = onlyDigits(customerEditForm.cep);
    if (cpfDigits && !isValidCPF(cpfDigits)) {
      setCustomerError('CPF inválido.');
      return;
    }
    if (cepDigits && cepDigits.length !== 8) {
      setCustomerError('CEP inválido (use 8 dígitos).');
      return;
    }
    if (cpfDigits) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('cpf', cpfDigits)
        .eq('clinic_id', clinicId)
        .maybeSingle();
      if (existing && existing.id !== editingCustomerId) {
        setCustomerError('CPF já cadastrado.');
        return;
      }
    }
    setAddingCustomer(true);
    try {
      const { error } = await supabase.from('customers').update({
        name: customerEditForm.name,
        cpf: cpfDigits || null,
        cep: cepDigits || null,
        clinic_id: clinicId
      }).eq('id', editingCustomerId);
      if (error) throw error;
      void saveCustomerGeo(editingCustomerId, cepDigits || null);
      setShowCustomerModal(false);
      setEditingCustomerId(null);
      setCustomerEditForm({ name: '', cpf: '', cep: '' });
      fetchCustomers();
    } catch (err: any) {
      alert('Erro ao salvar cliente: ' + err.message);
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Excluir cliente?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      if (editingCustomerId === id) {
        setEditingCustomerId(null);
        setCustomerForm({ name: '', cpf: '', cep: '' });
      }
      setSelectedCustomerIds((prev) => prev.filter((customerId) => customerId !== id));
      fetchCustomers();
    }
  };

  const handleDeleteSelectedCustomers = async () => {
    if (!selectedCustomerIds.length) return;
    if (!confirm(`Excluir ${selectedCustomerIds.length} clientes selecionados?`)) return;
    const { error } = await supabase.from('customers').delete().in('id', selectedCustomerIds);
    if (error) {
      alert('Erro ao excluir clientes: ' + error.message);
      return;
    }
    setSelectedCustomerIds([]);
    fetchCustomers();
  };

  const downloadCustomersCsv = (rows: any[]) => {
    const escapeValue = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Nome', 'CPF', 'CEP'];
    const lines = rows.map((row) => [
      escapeValue(row.name || ''),
      escapeValue(row.cpf || ''),
      escapeValue(row.cep || ''),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clientes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSuppliersCsv = (rows: any[]) => {
    const escapeValue = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['nome', 'documento', 'telefone'];
    const lines = rows.map((row) => [
      escapeValue(row.nome || ''),
      escapeValue(row.cnpj || ''),
      escapeValue(row.telefone || ''),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fornecedores.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCustomersPdf = (rows: any[]) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const tableRows = rows.map((row) => `
      <tr>
        <td>${row.name || ''}</td>
        <td>${row.cpf || ''}</td>
        <td>${row.cep || ''}</td>
      </tr>
    `).join('');
    win.document.write(`
      <html>
        <head>
          <title>Clientes</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Clientes</h2>
          <table>
            <thead>
              <tr><th>Nome</th><th>CPF</th><th>CEP</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const resetUserForm = () => {
    setUserForm({ name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [], avatar_url: null });
    setUserError(null);
    setUserAvatarFile(null);
    setUserAvatarPreview(null);
    setUserAvatarError(null);
  };

  const resetEditUserForm = () => {
    setEditingUserId(null);
    setEditUserForm({ name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [], avatar_url: null });
    setEditUserError(null);
    setEditUserAvatarFile(null);
    setEditUserAvatarPreview(null);
    setEditUserAvatarError(null);
  };

  const handleEditUser = (user: any) => {
    setEditingUserId(user.id);
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'user',
      ativo: user.ativo !== false,
      paginas_liberadas: user.paginas_liberadas || [],
      avatar_url: user.avatar_url || null,
    });
    setEditUserError(null);
    setEditUserAvatarFile(null);
    setEditUserAvatarPreview(null);
    setEditUserAvatarError(null);
    setShowUserModal(true);
  };

  const handleToggleUser = async (user: any) => {
    if (!clinicId) return;
    const { error } = await supabase
      .from('clinic_users')
      .update({ ativo: user.ativo === false })
      .eq('id', user.id)
      .eq('clinic_id', clinicId);
    if (error) {
      alert('Erro ao atualizar usuário: ' + error.message);
      return;
    }
    fetchClinicUsers();
  };

  const handleUserAvatarChange = async (file: File) => {
    const error = await validateAvatarFile(file);
    if (error) {
      setUserAvatarError(error);
      setUserAvatarFile(null);
      setUserAvatarPreview(null);
      return;
    }
    setUserAvatarError(null);
    setUserAvatarFile(file);
    setUserAvatarPreview(URL.createObjectURL(file));
  };

  const handleEditUserAvatarChange = async (file: File) => {
    const error = await validateAvatarFile(file);
    if (error) {
      setEditUserAvatarError(error);
      setEditUserAvatarFile(null);
      setEditUserAvatarPreview(null);
      return;
    }
    setEditUserAvatarError(null);
    setEditUserAvatarFile(file);
    setEditUserAvatarPreview(URL.createObjectURL(file));
  };

  const handleDeleteUser = async (user: any) => {
    if (!clinicId) return;
    if (!isClinicOwner) {
      alert('Apenas o super admin da clínica pode excluir usuários.');
      return;
    }
    const label = user.name || user.email || 'este usuário';
    if (!confirm(`Apagar ${label}?`)) return;
    const { error } = await supabase
      .from('clinic_users')
      .delete()
      .eq('id', user.id)
      .eq('clinic_id', clinicId);
    if (error) {
      alert('Erro ao apagar usuário: ' + error.message);
      return;
    }
    if (editingUserId === user.id) {
      setShowUserModal(false);
      resetEditUserForm();
    }
    fetchClinicUsers();
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isClinicOwner) {
      setUserError('Apenas o super admin da clínica pode gerenciar usuários.');
      return;
    }
    if (!clinicId) {
      setUserError('Nenhuma clínica ativa encontrada.');
      return;
    }
    const name = userForm.name.trim();
    const email = userForm.email.trim().toLowerCase();
    if (!name || !email) {
      setUserError('Nome e e-mail são obrigatórios.');
      return;
    }
    if (userAvatarError && userAvatarFile) {
      setUserError(userAvatarError);
      return;
    }
    const cleanedPages =
      availablePageOptions.length > 0
        ? userForm.paginas_liberadas.filter((page) => availablePageSet.has(page))
        : userForm.paginas_liberadas;
    setSavingUser(true);
    setUserError(null);
    let avatarUrl = userForm.avatar_url;
    if (userAvatarFile) {
      try {
        avatarUrl = await uploadClinicUserAvatar(clinicId, userAvatarFile);
      } catch (error) {
        setUserError(`Erro ao enviar imagem: ${(error as Error).message}`);
        setSavingUser(false);
        return;
      }
    }
    const payload = {
      clinic_id: clinicId,
      name,
      email,
      role: userForm.role,
      ativo: userForm.ativo,
      paginas_liberadas: cleanedPages,
      avatar_url: avatarUrl || null,
    };
    const response = await supabase.from('clinic_users').insert(payload);
    if (response.error) {
      setUserError(response.error.message);
      setSavingUser(false);
      return;
    }
    if (resetRedirectUrl) {
      const otpOptions: { emailRedirectTo?: string; shouldCreateUser: boolean } = {
        shouldCreateUser: true,
        emailRedirectTo: resetRedirectUrl,
      };
      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email,
        options: otpOptions,
      });
      if (inviteError) {
        setUserError(`Usuário criado, mas não foi possível enviar o e-mail: ${inviteError.message}`);
      }
    }
    resetUserForm();
    fetchClinicUsers();
    setSavingUser(false);
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isClinicOwner) {
      setEditUserError('Apenas o super admin da clínica pode gerenciar usuários.');
      return;
    }
    if (!clinicId) {
      setEditUserError('Nenhuma clínica ativa encontrada.');
      return;
    }
    if (!editingUserId) {
      setEditUserError('Nenhum usuário selecionado para edição.');
      return;
    }
    const name = editUserForm.name.trim();
    const email = editUserForm.email.trim().toLowerCase();
    if (!name || !email) {
      setEditUserError('Nome e e-mail são obrigatórios.');
      return;
    }
    if (editUserAvatarError && editUserAvatarFile) {
      setEditUserError(editUserAvatarError);
      return;
    }
    const cleanedPages =
      availablePageOptions.length > 0
        ? editUserForm.paginas_liberadas.filter((page) => availablePageSet.has(page))
        : editUserForm.paginas_liberadas;
    setSavingUser(true);
    setEditUserError(null);
    let avatarUrl = editUserForm.avatar_url;
    if (editUserAvatarFile) {
      try {
        avatarUrl = await uploadClinicUserAvatar(clinicId, editUserAvatarFile);
      } catch (error) {
        setEditUserError(`Erro ao enviar imagem: ${(error as Error).message}`);
        setSavingUser(false);
        return;
      }
    }
    const payload = {
      clinic_id: clinicId,
      name,
      email,
      role: editUserForm.role,
      ativo: editUserForm.ativo,
      paginas_liberadas: cleanedPages,
      avatar_url: avatarUrl || null,
    };
    const response = await supabase
      .from('clinic_users')
      .update(payload)
      .eq('id', editingUserId)
      .eq('clinic_id', clinicId);
    if (response.error) {
      setEditUserError(response.error.message);
      setSavingUser(false);
      return;
    }
    setShowUserModal(false);
    resetEditUserForm();
    fetchClinicUsers();
    setSavingUser(false);
  };

  const activePresetList = activeTab === 'receita' ? PRESET_REVENUE_CATEGORIES : PRESET_EXPENSE_CATEGORIES;
  const selectedForTab = activeTab === 'receita' ? selectedRevenueCategories : selectedExpenseCategories;
  const selectedPresetSet = useMemo(
    () => new Set(selectedForTab.map((name) => normalizeCategoryName(name))),
    [selectedForTab]
  );

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    const list = [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!term) return list;
    return list.filter((c) => (c.name || '').toLowerCase().includes(term));
  }, [customers, customerSearch]);
  const totalCustomerPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const customerPageSafe = Math.min(customerPage, totalCustomerPages);
  const paginatedCustomers = filteredCustomers.slice(
    (customerPageSafe - 1) * customerPageSize,
    customerPageSafe * customerPageSize
  );
  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return clinicUsers;
    return clinicUsers.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [clinicUsers, userSearch]);
  const userAvatarSrc = userAvatarPreview || userForm.avatar_url || '';
  const editUserAvatarSrc = editUserAvatarPreview || editUserForm.avatar_url || '';

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);

  useEffect(() => {
    if (customerPage > totalCustomerPages) {
      setCustomerPage(totalCustomerPages);
    }
  }, [customerPage, totalCustomerPages]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Minha Clínica</h1>
        <p className="text-gray-500">Gerencie informações e cadastros da clínica</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSectionAndUrl('geral')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'geral' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Informações gerais
        </button>
        <button
          onClick={() => setSectionAndUrl('categorias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'categorias' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Categorias
        </button>
        <button
          onClick={() => setSectionAndUrl('taxas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'taxas' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Taxas de Cartão
        </button>
        <button
          onClick={() => setSectionAndUrl('clientes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'clientes' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Clientes
        </button>
        <button
          onClick={() => setSectionAndUrl('profissionais')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'profissionais' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Profissionais
        </button>
        <button
          onClick={() => setSectionAndUrl('fornecedores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'fornecedores' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Fornecedores
        </button>
        {isAdmin && (
          <button
            onClick={() => setSectionAndUrl('usuarios')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'usuarios' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Usuários
          </button>
        )}
      </div>

      {section === 'geral' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="h-20 w-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
              {clinic?.logo_url ? (
                <img src={clinic.logo_url} alt="Logo da clínica" className="h-full w-full object-cover object-center" />
              ) : (
                <span>{(clinic?.name || 'CL').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Informações gerais</h2>
              <p className="text-sm text-gray-500">Dados cadastrados da clínica.</p>
            </div>
          </div>

          {!clinic ? (
            <div className="text-sm text-gray-500">Nenhuma clínica ativa encontrada.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">ID da clínica</p>
                  <p className="text-sm font-medium text-gray-800 break-all">{clinic.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nome da clínica</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Responsável</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.responsavel_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Documento</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.documento || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">E-mail de contato</p>
                  <p className="text-sm font-medium text-gray-800 break-all">{clinic.email_contato || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telefone de contato</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.telefone_contato || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Plano</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.plano || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.ativo === false ? 'Inativa' : 'Ativa'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Criado em</p>
                  <p className="text-sm font-medium text-gray-800">{clinic.created_at ? formatDate(clinic.created_at) : '-'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Páginas liberadas</p>
                {clinic.paginas_liberadas && clinic.paginas_liberadas.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {clinic.paginas_liberadas.map((page) => (
                      <span key={page} className="px-2 py-1 text-xs rounded-full border border-gray-200 text-gray-600">
                        {PAGE_LABEL_MAP[page] || page}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma página definida.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Categorias */}
      {section === 'categorias' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('receita')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'receita' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Categorias de Receitas
            </button>
            <button 
              onClick={() => setActiveTab('despesa')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'despesa' ? 'text-red-600 border-b-2 border-red-600 bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Categorias de Despesas
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">
                  Selecione as categorias padrão que ficarão disponíveis nos lançamentos de {activeTab === 'receita' ? 'receitas' : 'despesas'}.
                </p>
                <p className="text-xs text-amber-600">
                  Ao salvar, as categorias não selecionadas deixam de aparecer nas novas vendas/despesas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllCategories}
                  className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  onClick={clearAllCategories}
                  className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={saveCategorySelection}
                  disabled={savingCategories}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingCategories ? 'Salvando...' : 'Salvar seleção'}
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Selecionadas: {selectedForTab.length} de {activePresetList.length}
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {activePresetList.map((name) => {
                  const checked = selectedPresetSet.has(normalizeCategoryName(name));
                  const activeStyle = activeTab === 'receita'
                    ? 'border-brand-200 bg-brand-50'
                    : 'border-rose-200 bg-rose-50';
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
                        checked ? activeStyle : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategorySelection(name)}
                        className="h-4 w-4 text-brand-600 border-gray-300 rounded"
                      />
                      <span className="text-gray-700">{name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Taxas de Cartão */}
      {section === 'taxas' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><CreditCard size={18}/> Taxas por Bandeira</h2>
              <p className="text-sm text-gray-500">Cadastre a taxa (%) por bandeira de cartão de crédito.</p>
            </div>
          </div>

          <form onSubmit={handleAddFee} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bandeira</label>
              <input
                required
                value={feeForm.bandeira}
                onChange={e => setFeeForm({ ...feeForm, bandeira: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Ex: Visa, Master, Elo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxa (%)</label>
              <input
                required
                type="number"
                step="0.01"
                value={feeForm.taxa_percent}
                onChange={e => setFeeForm({ ...feeForm, taxa_percent: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas (mín)</label>
              <input
                required
                type="number"
                min="1"
                value={feeForm.min_installments}
                onChange={e => setFeeForm({ ...feeForm, min_installments: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas (máx)</label>
              <input
                required
                type="number"
                min="1"
                value={feeForm.max_installments}
                onChange={e => setFeeForm({ ...feeForm, max_installments: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingFee}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {addingFee ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingFeeId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cardFees.map(fee => (
              <div key={fee.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{fee.bandeira}</p>
                  <p className="text-sm text-gray-500">{fee.metodo} • {fee.min_installments}x até {fee.max_installments}x</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brand-600 font-bold">{fee.taxa_percent}%</span>
                  <button
                    onClick={() => {
                      setEditingFeeId(fee.id);
                      setFeeForm({
                        bandeira: fee.bandeira,
                        taxa_percent: String(fee.taxa_percent),
                        metodo: fee.metodo,
                        min_installments: String(fee.min_installments || 1),
                        max_installments: String(fee.max_installments || 1)
                      });
                    }}
                    className="text-gray-400 hover:text-brand-600"
                  >
                    Editar
                  </button>
                  <button onClick={() => handleDeleteFee(fee.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {cardFees.length === 0 && (
              <div className="text-sm text-gray-400">Nenhuma taxa cadastrada.</div>
            )}
          </div>
        </div>
      )}

      {/* Clientes */}
      {section === 'clientes' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={18}/> Clientes</h2>
              <p className="text-sm text-gray-500">Registre clientes. CPF e CEP são opcionais.</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent('Nome,CPF,CEP\nFulano da Silva,12345678909,01000-000\nMaria Souza,98765432100,20000-000')}`}
                download="modelo_clientes.csv"
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Modelo CSV
              </a>
              <button
                type="button"
                onClick={() => downloadCustomersCsv(filteredCustomers)}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Baixar CSV
              </button>
              <button
                type="button"
                onClick={() => downloadCustomersPdf(filteredCustomers)}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Baixar PDF
              </button>
              <label className={`px-3 py-2 text-sm bg-brand-600 text-white rounded-lg flex items-center gap-2 cursor-pointer hover:bg-brand-700 ${customerImporting ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={14}/> {customerImporting ? 'Importando...' : 'Importar CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return;
                    await handleImportCustomers(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {customerImportReport && (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              <p className="font-semibold text-gray-800 mb-1">Relatório de importação</p>
              <p className="text-gray-700">Importados: {customerImportReport.imported}</p>
              {customerImportReport.rejected.length > 0 && (
                <div className="mt-2 text-gray-700">
                  <p className="font-medium mb-1">Registros recusados:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {customerImportReport.rejected.map((r, idx) => (
                      <li key={idx}>
                        <span className="font-semibold">{r.name || '(sem nome)'}</span> — CPF: {r.cpf || '(vazio)'} — CEP: {r.cep || '-'} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                required
                value={customerForm.name}
                onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                value={customerForm.cpf}
                onChange={e => setCustomerForm({ ...customerForm, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Somente números"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <input
                value={customerForm.cep}
                onChange={e => setCustomerForm({ ...customerForm, cep: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={addingCustomer}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingCustomer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Salvar Cliente
              </button>
            </div>
          </form>
          {customerError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{customerError}</div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente por nome..."
              className="w-full md:max-w-xs px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedCustomerIds.includes(c.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCustomerIds(filteredCustomers.map((c) => c.id));
                    } else {
                      setSelectedCustomerIds([]);
                    }
                  }}
                />
                Selecionar todos
              </label>
              <button
                type="button"
                disabled={!selectedCustomerIds.length}
                onClick={handleDeleteSelectedCustomers}
                className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-100 disabled:opacity-50"
              >
                Excluir selecionados
              </button>
              <span className="text-xs text-gray-400">{filteredCustomers.length} clientes</span>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg divide-y">
            {paginatedCustomers.map(c => {
              const selected = selectedCustomerIds.includes(c.id);
              return (
                <div key={c.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCustomerIds((prev) => [...prev, c.id]);
                        else setSelectedCustomerIds((prev) => prev.filter((id) => id !== c.id));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">CPF: {c.cpf || '-'} • CEP: {c.cep || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCustomerError(null);
                        setEditingCustomerId(c.id);
                        setCustomerEditForm({ name: c.name || '', cpf: c.cpf || '', cep: c.cep || '' });
                        setShowCustomerModal(true);
                      }}
                      className="text-gray-400 hover:text-brand-600 text-sm"
                    >
                      Editar
                    </button>
                    <button onClick={() => handleDeleteCustomer(c.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredCustomers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum cliente cadastrado.</div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <button
              type="button"
              disabled={customerPageSafe <= 1}
              onClick={() => setCustomerPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Anterior
            </button>
            <span>Página {customerPageSafe} de {totalCustomerPages}</span>
            <button
              type="button"
              disabled={customerPageSafe >= totalCustomerPages}
              onClick={() => setCustomerPage((prev) => Math.min(totalCustomerPages, prev + 1))}
              className="px-3 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Próxima
            </button>
          </div>

          {showCustomerModal && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={customerModalControls.onBackdropClick}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-lg space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Editar cliente</h4>
                  <button
                    onClick={closeCustomerModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleUpdateCustomer} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      required
                      value={customerEditForm.name}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                    <input
                      value={customerEditForm.cpf}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, cpf: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                    <input
                      value={customerEditForm.cep}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, cep: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  {customerError && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{customerError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                    onClick={() => {
                      setShowCustomerModal(false);
                      setEditingCustomerId(null);
                      setCustomerError(null);
                    }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={addingCustomer}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {addingCustomer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Salvar alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Profissionais */}
      {section === 'profissionais' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={16}/> Profissionais</h2>
              <p className="text-sm text-gray-500">Cadastre profissionais para venda e execução.</p>
            </div>
          </div>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!professionalForm.nome.trim()) return;
              setSavingProfessional(true);
              try {
                if (editingProfessionalId) {
                  const { error } = await supabase.from('professionals').update({
                    nome: professionalForm.nome,
                    tipo: professionalForm.tipo,
                    clinic_id: clinicId,
                  }).eq('id', editingProfessionalId);
                  if (error) throw error;
                } else {
                  const { error } = await supabase.from('professionals').insert([{
                    nome: professionalForm.nome,
                    tipo: professionalForm.tipo,
                    clinic_id: clinicId,
                  }]);
                  if (error) throw error;
                }
                setProfessionalForm({ nome: '', tipo: 'venda' });
                setEditingProfessionalId(null);
                fetchProfessionals();
              } catch (err: any) {
                alert('Erro ao salvar profissional: ' + err.message);
              } finally {
                setSavingProfessional(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={professionalForm.nome}
                onChange={e => setProfessionalForm({ ...professionalForm, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome do profissional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={professionalForm.tipo}
                onChange={e => setProfessionalForm({ ...professionalForm, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="venda">Venda</option>
                <option value="execucao">Execução</option>
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingProfessional}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingProfessional ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingProfessionalId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="border border-gray-100 rounded-lg divide-y">
            {professionals.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{p.nome}</p>
                  <p className="text-xs text-gray-500">Tipo: {p.tipo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProfessionalId(p.id);
                      setProfessionalForm({ nome: p.nome || '', tipo: p.tipo || 'venda' });
                    }}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Excluir profissional?')) return;
                      const { error } = await supabase.from('professionals').delete().eq('id', p.id);
                      if (!error) fetchProfessionals();
                    }}
                    className="text-sm text-red-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {professionals.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum profissional cadastrado.</div>
            )}
          </div>
        </div>
      )}

      {/* Fornecedores */}
      {section === 'fornecedores' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={16}/> Fornecedores</h2>
              <p className="text-sm text-gray-500">Cadastre fornecedores para usar no lançamento de despesas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent('nome,documento,telefone\nFornecedor Ltda,12345678000199,11999999999')}`}
                download="modelo_fornecedores.csv"
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Modelo CSV
              </a>
              <button
                type="button"
                onClick={() => downloadSuppliersCsv(suppliers)}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Baixar CSV
              </button>
              <label className={`px-3 py-2 text-sm bg-brand-600 text-white rounded-lg flex items-center gap-2 cursor-pointer hover:bg-brand-700 ${supplierImporting ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={14}/> {supplierImporting ? 'Importando...' : 'Importar CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return;
                    await handleImportSuppliers(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!supplierForm.nome.trim()) return;
              setSavingSupplier(true);
              try {
                if (editingSupplierId) {
                  const { error } = await supabase.from('suppliers').update({
                    nome: supplierForm.nome,
                    cnpj: supplierForm.cnpj,
                    telefone: supplierForm.telefone,
                    clinic_id: clinicId,
                  }).eq('id', editingSupplierId);
                  if (error) throw error;
                } else {
                  const { error } = await supabase.from('suppliers').insert([{
                    nome: supplierForm.nome,
                    cnpj: supplierForm.cnpj,
                    telefone: supplierForm.telefone,
                    clinic_id: clinicId,
                  }]);
                  if (error) throw error;
                }
                setSupplierForm({ nome: '', cnpj: '', telefone: '' });
                setEditingSupplierId(null);
                fetchSuppliers();
              } catch (err: any) {
                alert('Erro ao salvar fornecedor: ' + err.message);
              } finally {
                setSavingSupplier(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
              <input
                value={supplierForm.nome}
                onChange={e => setSupplierForm({ ...supplierForm, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Fornecedor Ltda"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                value={supplierForm.cnpj}
                onChange={e => setSupplierForm({ ...supplierForm, cnpj: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Somente números"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={supplierForm.telefone}
                onChange={e => setSupplierForm({ ...supplierForm, telefone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingSupplier}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingSupplier ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingSupplierId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="border border-gray-100 rounded-lg divide-y">
            {suppliers.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{s.nome}</p>
                  <p className="text-xs text-gray-500">CNPJ: {s.cnpj || '-'} • Tel: {s.telefone || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSupplierId(s.id);
                      setSupplierForm({ nome: s.nome || '', cnpj: s.cnpj || '', telefone: s.telefone || '' });
                    }}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Excluir fornecedor?')) return;
                      const { error } = await supabase.from('suppliers').delete().eq('id', s.id);
                      if (!error) fetchSuppliers();
                    }}
                    className="text-sm text-red-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum fornecedor cadastrado.</div>
            )}
          </div>
        </div>
      )}

      {/* Usuários */}
      {section === 'usuarios' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          {!isClinicOwner ? (
            <div className="text-sm text-gray-500">Acesso restrito ao super admin da clínica.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Users size={16}/> Usuários</h2>
                  <p className="text-sm text-gray-500">Crie usuários e defina quais páginas cada um pode acessar.</p>
                </div>
              </div>

              {!clinicId ? (
                <div className="text-sm text-gray-500">Selecione uma clínica para gerenciar usuários.</div>
              ) : (
                <>
                  <form onSubmit={handleSaveUser} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                        <input
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          placeholder="Nome do usuário"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          placeholder="email@clinica.com"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Imagem do usuário</label>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-[10px] text-gray-400">
                            {userAvatarSrc ? (
                              <img src={userAvatarSrc} alt="Avatar do usuário" className="h-full w-full object-cover" />
                            ) : (
                              <span>Sem imagem</span>
                            )}
                          </div>
                          <label className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                            {userAvatarSrc ? 'Trocar imagem' : 'Adicionar imagem'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) await handleUserAvatarChange(file);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <span className="text-xs text-gray-500">Quadrada até 350 x 350.</span>
                        </div>
                        {userAvatarError && <p className="text-xs text-red-600 mt-1">{userAvatarError}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="user-active"
                          type="checkbox"
                          checked={userForm.ativo}
                          onChange={(e) => setUserForm({ ...userForm, ativo: e.target.checked })}
                          className="h-4 w-4 text-brand-600"
                        />
                        <label htmlFor="user-active" className="text-sm text-gray-700">Usuário ativo</label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">Páginas liberadas</p>
                        {availablePageOptions.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setUserForm((prev) => ({
                                  ...prev,
                                  paginas_liberadas: availablePageOptions.map((p) => p.value),
                                }))
                              }
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                            >
                              Selecionar tudo
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserForm((prev) => ({ ...prev, paginas_liberadas: [] }))}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100"
                            >
                              Limpar
                            </button>
                          </div>
                        )}
                      </div>
                      {availablePageOptions.length === 0 ? (
                        <p className="text-sm text-gray-500">Defina as páginas liberadas para a clínica antes de liberar acessos.</p>
                      ) : (
                        <div className="space-y-2">
                          <details ref={pageMenuRef} className="relative">
                            <summary className="list-none cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
                              Selecionar página...
                            </summary>
                            <div className="absolute z-20 mt-2 w-full max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                              {availablePageOptions.map((page) => (
                                <button
                                  key={page.value}
                                  type="button"
                                  onClick={() => {
                                    if (userForm.paginas_liberadas.includes(page.value)) return;
                                    setUserForm((prev) => ({
                                      ...prev,
                                      paginas_liberadas: [...prev.paginas_liberadas, page.value],
                                    }));
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
                            {userForm.paginas_liberadas.map((page) => (
                              <button
                                key={page}
                                type="button"
                                onClick={() =>
                                  setUserForm((prev) => ({
                                    ...prev,
                                    paginas_liberadas: prev.paginas_liberadas.filter((p) => p !== page),
                                  }))
                                }
                                className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
                              >
                                {PAGE_LABEL_MAP[page] || page} ✕
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {userError && <p className="text-sm text-red-600">{userError}</p>}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingUser}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Adicionar usuário
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar usuário..."
                        className="w-full md:max-w-xs px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <span className="text-xs text-gray-400">{filteredUsers.length} usuários</span>
                    </div>
                    <div className="border border-gray-100 rounded-lg divide-y">
                      {usersLoading && (
                        <div className="p-4 text-sm text-gray-400 text-center">Carregando usuários...</div>
                      )}
                      {!usersLoading && filteredUsers.map((u) => (
                        <div key={u.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-16 w-16 shrink-0 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={`Foto de ${u.name || 'usuário'}`} className="h-full w-full object-cover object-center" />
                              ) : (
                                <span>{getUserInitials(u.name || '', u.email || '')}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{u.name}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                              <p className="text-xs text-gray-500">
                                Perfil: {u.role || 'user'} • {u.ativo === false ? 'Inativo' : 'Ativo'}
                              </p>
                              {u.paginas_liberadas && u.paginas_liberadas.length > 0 && (
                                <p className="text-xs text-gray-500">
                                  Páginas: {u.paginas_liberadas.map((p: string) => PAGE_LABEL_MAP[p] || p).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditUser(u)}
                              className="text-sm text-brand-600"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUser(u)}
                              className={`text-sm ${u.ativo === false ? 'text-emerald-600' : 'text-red-600'}`}
                            >
                              {u.ativo === false ? 'Ativar' : 'Desativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="text-sm text-red-600"
                            >
                              Apagar
                            </button>
                          </div>
                        </div>
                      ))}
                      {!usersLoading && filteredUsers.length === 0 && (
                        <div className="p-4 text-sm text-gray-400 text-center">Nenhum usuário cadastrado.</div>
                      )}
                    </div>
                  </div>

                  {showUserModal && (
                    <div
                      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
                      onClick={userModalControls.onBackdropClick}
                    >
                      <div
                        className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-auto space-y-4"
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
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                              <input
                                value={editUserForm.name}
                                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                                placeholder="Nome do usuário"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                              <input
                                type="email"
                                value={editUserForm.email}
                                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                                placeholder="email@clinica.com"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Imagem do usuário</label>
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="h-16 w-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-500">
                                  {editUserAvatarSrc ? (
                                    <img src={editUserAvatarSrc} alt="Avatar do usuário" className="h-full w-full object-cover object-center" />
                                  ) : (
                                    <span>{getUserInitials(editUserForm.name || '', editUserForm.email || '')}</span>
                                  )}
                                </div>
                                <label className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                                  {editUserAvatarSrc ? 'Trocar imagem' : 'Adicionar imagem'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) await handleEditUserAvatarChange(file);
                                      e.currentTarget.value = '';
                                    }}
                                  />
                                </label>
                                <span className="text-xs text-gray-500">Quadrada até 350 x 350.</span>
                              </div>
                              {editUserAvatarError && <p className="text-xs text-red-600 mt-1">{editUserAvatarError}</p>}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                              <select
                                value={editUserForm.role}
                                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                              >
                                <option value="user">Usuário</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                id="edit-user-active"
                                type="checkbox"
                                checked={editUserForm.ativo}
                                onChange={(e) => setEditUserForm({ ...editUserForm, ativo: e.target.checked })}
                                className="h-4 w-4 text-brand-600"
                              />
                              <label htmlFor="edit-user-active" className="text-sm text-gray-700">Usuário ativo</label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-700">Páginas liberadas</p>
                              {availablePageOptions.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditUserForm((prev) => ({
                                        ...prev,
                                        paginas_liberadas: availablePageOptions.map((p) => p.value),
                                      }))
                                    }
                                    className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                                  >
                                    Selecionar tudo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditUserForm((prev) => ({ ...prev, paginas_liberadas: [] }))}
                                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              )}
                            </div>
                            {availablePageOptions.length === 0 ? (
                              <p className="text-sm text-gray-500">Defina as páginas liberadas para a clínica antes de liberar acessos.</p>
                            ) : (
                              <div className="space-y-2">
                                <details ref={editPageMenuRef} className="relative">
                                  <summary className="list-none cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
                                    Selecionar página...
                                  </summary>
                                  <div className="absolute z-20 mt-2 w-full max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                                    {availablePageOptions.map((page) => (
                                      <button
                                        key={page.value}
                                        type="button"
                                        onClick={() => {
                                          if (editUserForm.paginas_liberadas.includes(page.value)) return;
                                          setEditUserForm((prev) => ({
                                            ...prev,
                                            paginas_liberadas: [...prev.paginas_liberadas, page.value],
                                          }));
                                          if (editPageMenuRef.current) editPageMenuRef.current.removeAttribute('open');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                      >
                                        {page.label}
                                      </button>
                                    ))}
                                  </div>
                                </details>
                                <div className="flex flex-wrap gap-2">
                                  {editUserForm.paginas_liberadas.map((page) => (
                                    <button
                                      key={page}
                                      type="button"
                                      onClick={() =>
                                        setEditUserForm((prev) => ({
                                          ...prev,
                                          paginas_liberadas: prev.paginas_liberadas.filter((p) => p !== page),
                                        }))
                                      }
                                      className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
                                    >
                                      {PAGE_LABEL_MAP[page] || page} ✕
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {editUserError && <p className="text-sm text-red-600">{editUserError}</p>}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserModal(false);
                                resetEditUserForm();
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
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
