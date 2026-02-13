import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Settings,
  X,
  Loader2,
} from 'lucide-react';
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { ToastStack } from '../components/Toast';

const supabaseAny = supabase as any;

interface ContractRow {
  id: string;
  clinic_id: string;
  products: string[] | null;
  package_id?: string | null;
  amount_cents?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  owner_user_id?: string | null;
  clinics?: {
    id: string;
    name: string;
    documento?: string | null;
    email_contato?: string | null;
  } | null;
  package?: {
    id: string;
    name: string;
  } | null;
}

interface StageRow {
  id: string;
  name: string;
  order_index: number;
  is_archived_stage: boolean;
}

interface LeadRow {
  id: string;
  name: string;
  company_name?: string | null;
  tenant_candidate_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  source?: string | null;
  owner_user_id?: string | null;
  value_potential_cents?: number | null;
  status?: string | null;
  current_stage_id?: string | null;
  last_interaction_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string | null;
  stage?: StageRow | null;
}

const DEFAULT_PRODUCTS = [
  'Plataforma OnePay',
  'Cursos',
  'Consultoria',
  'Mentoria',
  'Suporte',
  'Onboarding',
];

const DEFAULT_STAGES = [
  { name: 'Novo lead', order_index: 0, is_archived_stage: false },
  { name: 'Qualificação', order_index: 1, is_archived_stage: false },
  { name: 'Proposta enviada', order_index: 2, is_archived_stage: false },
  { name: 'Negociação', order_index: 3, is_archived_stage: false },
  { name: 'Ganho', order_index: 4, is_archived_stage: false },
  { name: 'Arquivados', order_index: 5, is_archived_stage: true },
];

const toCurrencyInput = (value?: number | null) => {
  if (!value && value !== 0) return '';
  return (value / 100).toFixed(2).replace('.', ',');
};

const parseCurrency = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
};

const getDaysToEnd = (endDate?: string | null) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

const getStatusBadge = (status?: string | null) => {
  switch (status) {
    case 'ativo':
      return 'bg-emerald-50 text-emerald-700';
    case 'vencendo':
      return 'bg-amber-50 text-amber-700';
    case 'encerrado':
      return 'bg-gray-100 text-gray-600';
    case 'cancelado':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
};

const buildQuery = (base: string, params: Record<string, string | string[]>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(','));
      return;
    }
    if (value) query.set(key, value);
  });
  return `${base}?${query.toString()}`;
};

const StageColumn: React.FC<{
  stage: StageRow;
  leads: LeadRow[];
  onOpenLead: (lead: LeadRow) => void;
  onActivity: (lead: LeadRow) => void;
  onFollowUp: (lead: LeadRow) => void;
  onWon: (lead: LeadRow) => void;
  onLost: (lead: LeadRow) => void;
}> = ({ stage, leads, onOpenLead, onActivity, onFollowUp, onWon, onLost }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] max-w-[320px] flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm ${
        isOver ? 'ring-2 ring-brand-400' : ''
      }`}
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{stage.name}</p>
          <p className="text-xs text-gray-500">{leads.length} lead(s)</p>
        </div>
        {stage.is_archived_stage && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Arquivados</span>
        )}
      </div>
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[520px]">
        {leads.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-6">Arraste leads para cá</div>
        )}
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpen={() => onOpenLead(lead)}
            onActivity={() => onActivity(lead)}
            onFollowUp={() => onFollowUp(lead)}
            onWon={() => onWon(lead)}
            onLost={() => onLost(lead)}
          />
        ))}
      </div>
    </div>
  );
};

const LeadCard: React.FC<{
  lead: LeadRow;
  onOpen: () => void;
  onActivity: () => void;
  onFollowUp: () => void;
  onWon: () => void;
  onLost: () => void;
}> = ({ lead, onOpen, onActivity, onFollowUp, onWon, onLost }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead:${lead.id}`,
    data: { stageId: lead.current_stage_id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const value = lead.value_potential_cents !== null && lead.value_potential_cents !== undefined
    ? formatCurrency(lead.value_potential_cents / 100)
    : '-';
  const nextFollowUp = lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : '-';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-2 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-70' : ''
      }`}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-800">{lead.name}</p>
        <p className="text-xs text-gray-500">{lead.company_name || lead.tenant_candidate_name || '-'}</p>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>Origem: {lead.source || '-'}</p>
        <p>Valor potencial: {value}</p>
        <p>Próx. follow-up: {nextFollowUp}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={onOpen} className="text-brand-600 hover:text-brand-700">Abrir lead</button>
        <button onClick={onActivity} className="text-gray-500 hover:text-gray-700">Registrar atividade</button>
        <button onClick={onFollowUp} className="text-gray-500 hover:text-gray-700">Agendar follow-up</button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={onWon} className="text-emerald-600 hover:text-emerald-700">Marcar ganho</button>
        <button onClick={onLost} className="text-red-600 hover:text-red-700">Marcar perdido</button>
      </div>
    </div>
  );
};

const AdminCommercialReports: React.FC = () => {
  const { toasts, push, dismiss } = useToast();
  const [activeTab, setActiveTab] = useState<'gerencial' | 'vendas'>('gerencial');
  const [packages, setPackages] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractPage, setContractPage] = useState(1);
  const [contractTotal, setContractTotal] = useState(0);
  const [contractSort, setContractSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({
    field: 'end_date',
    dir: 'asc',
  });
  const [contractFilters, setContractFilters] = useState({
    search: '',
    status: '',
    startFrom: '',
    startTo: '',
    endFrom: '',
    endTo: '',
    amountMin: '',
    amountMax: '',
    products: [] as string[],
    packageIds: [] as string[],
  });
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const [stages, setStages] = useState<StageRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [stageManagerOpen, setStageManagerOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [sequenceModalOpen, setSequenceModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [activityLead, setActivityLead] = useState<LeadRow | null>(null);
  const [sequenceLead, setSequenceLead] = useState<LeadRow | null>(null);
  const [leadFilters, setLeadFilters] = useState({
    search: '',
    status: '',
    owner: '',
    source: '',
    createdFrom: '',
    createdTo: '',
    valueMin: '',
    valueMax: '',
  });
  const [leadPdfLimit, setLeadPdfLimit] = useState('200');
  const [leadForm, setLeadForm] = useState({
    name: '',
    company_name: '',
    tenant_candidate_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    source: '',
    owner_user_id: '',
    value_potential: '',
    status: 'ativo',
    current_stage_id: '',
  });
  const [activityForm, setActivityForm] = useState({
    type: 'note',
    notes: '',
    next_follow_up_at: '',
  });
  const [sequenceForm, setSequenceForm] = useState({
    channel: 'whatsapp',
    template: '',
    scheduled_at: '',
    status: 'pending',
  });

  const contractPageSize = 10;

  const productsOptions = useMemo(() => {
    const set = new Set(DEFAULT_PRODUCTS);
    contracts.forEach((row) => {
      (row.products || []).forEach((product) => set.add(product));
    });
    return Array.from(set);
  }, [contracts]);

  const internalUsersMap = useMemo(() => {
    const map = new Map<string, string>();
    internalUsers.forEach((user) => {
      if (!user?.id) return;
      map.set(user.id, user.full_name || user.id);
    });
    return map;
  }, [internalUsers]);

  const sourcesOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((lead) => {
      if (lead.source) set.add(lead.source);
    });
    return Array.from(set);
  }, [leads]);

  const archivedStage = useMemo(() => stages.find((stage) => stage.is_archived_stage), [stages]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    stages.forEach((stage) => map.set(stage.id, []));
    leads.forEach((lead) => {
      if (!lead.current_stage_id) return;
      if (!map.has(lead.current_stage_id)) map.set(lead.current_stage_id, []);
      map.get(lead.current_stage_id)?.push(lead);
    });
    return map;
  }, [leads, stages]);

  const fetchPackages = async () => {
    const { data } = await (supabase as any).from('content_packages').select('*').order('created_at', { ascending: false });
    setPackages((data || []) as any[]);
  };

  const fetchInternalUsers = async () => {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales'])
      .order('full_name', { ascending: true });
    setInternalUsers((data || []) as any[]);
  };

  const resolveClinicIds = async (search: string) => {
    if (!search.trim()) return null;
    const { data } = await supabase
      .from('clinics')
      .select('id')
      .or(`name.ilike.%${search}%,documento.ilike.%${search}%,email_contato.ilike.%${search}%`);
    const ids = (data || []).map((row: any) => row.id).filter(Boolean);
    return ids.length ? ids : [];
  };

  const loadContracts = async () => {
    setContractsLoading(true);
    try {
      let query = supabaseAny
        .from('commercial_contracts')
        .select(
          `id, clinic_id, products, package_id, amount_cents, start_date, end_date, status, owner_user_id,
           clinics:clinics (id, name, documento, email_contato),
           package:content_packages (id, name)`,
          { count: 'exact' },
        );

      if (contractFilters.status) query = query.eq('status', contractFilters.status);
      if (contractFilters.startFrom) query = query.gte('start_date', contractFilters.startFrom);
      if (contractFilters.startTo) query = query.lte('start_date', contractFilters.startTo);
      if (contractFilters.endFrom) query = query.gte('end_date', contractFilters.endFrom);
      if (contractFilters.endTo) query = query.lte('end_date', contractFilters.endTo);
      const amountMin = parseCurrency(contractFilters.amountMin);
      const amountMax = parseCurrency(contractFilters.amountMax);
      if (amountMin !== null) query = query.gte('amount_cents', amountMin);
      if (amountMax !== null) query = query.lte('amount_cents', amountMax);
      if (contractFilters.packageIds.length) query = query.in('package_id', contractFilters.packageIds);
      if (contractFilters.products.length) query = query.overlaps('products', contractFilters.products);

      if (contractFilters.search.trim()) {
        const clinicIds = await resolveClinicIds(contractFilters.search);
        if (clinicIds && clinicIds.length === 0) {
          setContracts([]);
          setContractTotal(0);
          setContractsLoading(false);
          return;
        }
        if (clinicIds && clinicIds.length) query = query.in('clinic_id', clinicIds);
      }

      query = query.order(contractSort.field, { ascending: contractSort.dir === 'asc', nullsFirst: false });
      const from = (contractPage - 1) * contractPageSize;
      const to = from + contractPageSize - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;
      setContracts((data || []) as ContractRow[]);
      setContractTotal(count || 0);
    } catch (error: any) {
      push({ title: 'Erro ao carregar contratos', description: error?.message, variant: 'error' });
    } finally {
      setContractsLoading(false);
    }
  };

  const ensureStages = async () => {
    const { data } = await supabaseAny.from('sales_stages').select('*').order('order_index', { ascending: true });
    if (data && data.length) {
      setStages(data as StageRow[]);
      return data as StageRow[];
    }
    const { data: created } = await supabaseAny.from('sales_stages').insert(DEFAULT_STAGES).select('*');
    setStages((created || []) as StageRow[]);
    return (created || []) as StageRow[];
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    try {
      let query = supabaseAny
        .from('sales_leads')
        .select(
          `id, name, company_name, tenant_candidate_name, email, phone, whatsapp, source, owner_user_id,
           value_potential_cents, status, current_stage_id, last_interaction_at, next_follow_up_at, created_at,
           stage:sales_stages (id, name, order_index, is_archived_stage)`
        )
        .order('created_at', { ascending: false });

      if (leadFilters.status) query = query.eq('status', leadFilters.status);
      if (leadFilters.owner) query = query.eq('owner_user_id', leadFilters.owner);
      if (leadFilters.source) query = query.eq('source', leadFilters.source);
      if (leadFilters.createdFrom) query = query.gte('created_at', leadFilters.createdFrom);
      if (leadFilters.createdTo) query = query.lte('created_at', leadFilters.createdTo);
      const valueMin = parseCurrency(leadFilters.valueMin);
      const valueMax = parseCurrency(leadFilters.valueMax);
      if (valueMin !== null) query = query.gte('value_potential_cents', valueMin);
      if (valueMax !== null) query = query.lte('value_potential_cents', valueMax);
      if (leadFilters.search) {
        query = query.or(
          `name.ilike.%${leadFilters.search}%,company_name.ilike.%${leadFilters.search}%,tenant_candidate_name.ilike.%${leadFilters.search}%,email.ilike.%${leadFilters.search}%,phone.ilike.%${leadFilters.search}%,whatsapp.ilike.%${leadFilters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeads((data || []) as LeadRow[]);
    } catch (error: any) {
      push({ title: 'Erro ao carregar leads', description: error?.message, variant: 'error' });
    } finally {
      setLeadsLoading(false);
    }
  };

  const openLeadModal = (lead?: LeadRow) => {
    if (lead) {
      setEditingLead(lead);
      setLeadForm({
        name: lead.name || '',
        company_name: lead.company_name || '',
        tenant_candidate_name: lead.tenant_candidate_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        whatsapp: lead.whatsapp || '',
        source: lead.source || '',
        owner_user_id: lead.owner_user_id || '',
        value_potential: toCurrencyInput(lead.value_potential_cents),
        status: lead.status || 'ativo',
        current_stage_id: lead.current_stage_id || stages[0]?.id || '',
      });
    } else {
      setEditingLead(null);
      setLeadForm({
        name: '',
        company_name: '',
        tenant_candidate_name: '',
        email: '',
        phone: '',
        whatsapp: '',
        source: '',
        owner_user_id: '',
        value_potential: '',
        status: 'ativo',
        current_stage_id: stages[0]?.id || '',
      });
    }
    setLeadModalOpen(true);
  };

  const saveLead = async () => {
    if (!leadForm.name.trim()) {
      push({ title: 'Informe o nome do lead.', variant: 'error' });
      return;
    }
    const payload = {
      name: leadForm.name.trim(),
      company_name: leadForm.company_name.trim() || null,
      tenant_candidate_name: leadForm.tenant_candidate_name.trim() || null,
      email: leadForm.email.trim() || null,
      phone: leadForm.phone.trim() || null,
      whatsapp: leadForm.whatsapp.trim() || null,
      source: leadForm.source.trim() || null,
      owner_user_id: leadForm.owner_user_id || null,
      value_potential_cents: parseCurrency(leadForm.value_potential) || null,
      status: leadForm.status || 'ativo',
      current_stage_id: leadForm.current_stage_id || null,
    };

    const { error } = editingLead
      ? await supabaseAny.from('sales_leads').update(payload).eq('id', editingLead.id)
      : await supabaseAny.from('sales_leads').insert(payload);
    if (error) {
      push({ title: 'Erro ao salvar lead', description: error.message, variant: 'error' });
      return;
    }
    setLeadModalOpen(false);
    await loadLeads();
  };

  const openActivityModal = (lead: LeadRow, presetFollowUp = false) => {
    setActivityLead(lead);
    setActivityForm({
      type: presetFollowUp ? 'meeting' : 'note',
      notes: '',
      next_follow_up_at: presetFollowUp ? new Date().toISOString().slice(0, 16) : '',
    });
    setActivityModalOpen(true);
  };

  const saveActivity = async () => {
    if (!activityLead) return;
    const payload = {
      lead_id: activityLead.id,
      type: activityForm.type,
      notes: activityForm.notes.trim() || null,
      next_follow_up_at: activityForm.next_follow_up_at || null,
    };
    const { error } = await supabaseAny.from('sales_activities').insert(payload);
    if (error) {
      push({ title: 'Erro ao registrar atividade', description: error.message, variant: 'error' });
      return;
    }
    setActivityModalOpen(false);
    await loadLeads();
  };

  const openSequenceModal = (lead: LeadRow) => {
    setSequenceLead(lead);
    setSequenceForm({
      channel: 'whatsapp',
      template: '',
      scheduled_at: '',
      status: 'pending',
    });
    setSequenceModalOpen(true);
  };

  const saveSequence = async () => {
    if (!sequenceLead) return;
    const payload = {
      lead_id: sequenceLead.id,
      channel: sequenceForm.channel,
      template: sequenceForm.template.trim() || null,
      scheduled_at: sequenceForm.scheduled_at || null,
      status: sequenceForm.status,
    };
    const { error } = await supabaseAny.from('sales_sequences').insert(payload);
    if (error) {
      push({ title: 'Erro ao salvar sequência', description: error.message, variant: 'error' });
      return;
    }
    setSequenceModalOpen(false);
    push({ title: 'Sequência registrada', variant: 'success' });
  };

  const startSalesFlow = (leadId: string) => {
    // Placeholder para integração com o fluxo comercial existente.
    // eslint-disable-next-line no-console
    console.info('startSalesFlow', leadId);
  };

  const markLeadWon = async (lead: LeadRow) => {
    const { error } = await supabaseAny
      .from('sales_leads')
      .update({ status: 'ganho' })
      .eq('id', lead.id);
    if (error) {
      push({ title: 'Erro ao marcar ganho', description: error.message, variant: 'error' });
      return;
    }
    startSalesFlow(lead.id);
    await loadLeads();
  };

  const markLeadLost = async (lead: LeadRow) => {
    const archivedId = archivedStage?.id || null;
    const { error } = await supabaseAny
      .from('sales_leads')
      .update({ status: 'arquivado', current_stage_id: archivedId })
      .eq('id', lead.id);
    if (error) {
      push({ title: 'Erro ao marcar perdido', description: error.message, variant: 'error' });
      return;
    }
    await loadLeads();
    openSequenceModal(lead);
  };

  const moveLeadToStage = async (leadId: string, stageId: string) => {
    const { error } = await supabaseAny.from('sales_leads').update({ current_stage_id: stageId }).eq('id', leadId);
    if (error) {
      push({ title: 'Erro ao mover lead', description: error.message, variant: 'error' });
      return;
    }
    await loadLeads();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId) return;
    const activeId = String(event.active.id);
    const dropId = String(overId);
    if (!activeId.startsWith('lead:') || !dropId.startsWith('stage:')) return;
    const leadId = activeId.replace('lead:', '');
    const stageId = dropId.replace('stage:', '');
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.current_stage_id === stageId) return;
    await moveLeadToStage(leadId, stageId);
  };

  const addStage = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const archived = stages.find((stage) => stage.is_archived_stage);
    if (archived) {
      const { error: updateError } = await supabaseAny
        .from('sales_stages')
        .update({ order_index: archived.order_index + 1 })
        .eq('id', archived.id);
      if (updateError) {
        push({ title: 'Erro ao ajustar etapa arquivada', description: updateError.message, variant: 'error' });
        return;
      }
      const { data, error } = await supabaseAny
        .from('sales_stages')
        .insert({ name: trimmed, order_index: archived.order_index, is_archived_stage: false })
        .select('*');
      if (error) {
        push({ title: 'Erro ao criar etapa', description: error.message, variant: 'error' });
        return;
      }
      setStages((prev) =>
        [...prev.map((item) => (item.id === archived.id ? { ...item, order_index: archived.order_index + 1 } : item)), ...(data as StageRow[])]
          .sort((a, b) => a.order_index - b.order_index)
      );
      return;
    }
    const maxOrder = stages.reduce((acc, stage) => Math.max(acc, stage.order_index), 0);
    const { data, error } = await supabaseAny
      .from('sales_stages')
      .insert({ name: trimmed, order_index: maxOrder + 1, is_archived_stage: false })
      .select('*');
    if (error) {
      push({ title: 'Erro ao criar etapa', description: error.message, variant: 'error' });
      return;
    }
    setStages((prev) => [...prev, ...(data as StageRow[])]);
  };

  const renameStage = async (stage: StageRow, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.name) return;
    const { error } = await supabaseAny.from('sales_stages').update({ name: trimmed }).eq('id', stage.id);
    if (error) {
      push({ title: 'Erro ao renomear etapa', description: error.message, variant: 'error' });
      return;
    }
    setStages((prev) => prev.map((item) => (item.id === stage.id ? { ...item, name: trimmed } : item)));
  };

  const moveStage = async (stage: StageRow, direction: 'up' | 'down') => {
    const sorted = [...stages].sort((a, b) => a.order_index - b.order_index);
    const index = sorted.findIndex((item) => item.id === stage.id);
    const swapWith = direction === 'up' ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    const updates = [
      { id: stage.id, order_index: swapWith.order_index },
      { id: swapWith.id, order_index: stage.order_index },
    ];
    const { error } = await supabaseAny.from('sales_stages').upsert(updates);
    if (error) {
      push({ title: 'Erro ao ordenar etapas', description: error.message, variant: 'error' });
      return;
    }
    setStages((prev) =>
      prev
        .map((item) =>
          item.id === stage.id
            ? { ...item, order_index: swapWith.order_index }
            : item.id === swapWith.id
              ? { ...item, order_index: stage.order_index }
              : item
        )
        .sort((a, b) => a.order_index - b.order_index)
    );
  };

  const deleteStage = async (stage: StageRow) => {
    if (stage.is_archived_stage) {
      push({ title: 'A etapa Arquivados não pode ser removida.', variant: 'error' });
      return;
    }
    const hasLeads = leads.some((lead) => lead.current_stage_id === stage.id);
    if (hasLeads) {
      push({ title: 'Existem leads nesta etapa.', description: 'Mova os leads antes de excluir.', variant: 'error' });
      return;
    }
    const { error } = await supabaseAny.from('sales_stages').delete().eq('id', stage.id);
    if (error) {
      push({ title: 'Erro ao remover etapa', description: error.message, variant: 'error' });
      return;
    }
    setStages((prev) => prev.filter((item) => item.id !== stage.id));
  };

  const downloadExport = async (format: 'excel' | 'pdf', type: 'gerencial' | 'vendas') => {
    try {
      setExporting(`${format}-${type}`);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        push({ title: 'Sessão inválida.', variant: 'error' });
        return;
      }
      const params: Record<string, string | string[]> = { type };
      if (type === 'gerencial') {
        params.search = contractFilters.search;
        params.status = contractFilters.status;
        params.start_from = contractFilters.startFrom;
        params.start_to = contractFilters.startTo;
        params.end_from = contractFilters.endFrom;
        params.end_to = contractFilters.endTo;
        params.amount_min = contractFilters.amountMin;
        params.amount_max = contractFilters.amountMax;
        params.products = contractFilters.products;
        params.package_ids = contractFilters.packageIds;
      } else {
        params.search = leadFilters.search;
        params.status = leadFilters.status;
        params.owner = leadFilters.owner;
        params.source = leadFilters.source;
        params.created_from = leadFilters.createdFrom;
        params.created_to = leadFilters.createdTo;
        params.value_min = leadFilters.valueMin;
        params.value_max = leadFilters.valueMax;
        if (format === 'pdf' && leadPdfLimit) params.limit = leadPdfLimit;
      }
      const url = buildQuery(`/api/export/${format}`, params);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Falha ao exportar.');
      }
      const blob = await response.blob();
      const extension = format === 'excel' ? 'xls' : 'pdf';
      const filename = type === 'gerencial' ? `relatorio-gerencial.${extension}` : `relatorio-vendas.${extension}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error: any) {
      push({ title: 'Erro ao exportar', description: error?.message, variant: 'error' });
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchInternalUsers();
  }, []);

  useEffect(() => {
    loadContracts();
  }, [contractFilters, contractPage, contractSort]);

  useEffect(() => {
    setContractPage(1);
  }, [contractFilters]);

  useEffect(() => {
    ensureStages().then(() => loadLeads());
  }, []);

  useEffect(() => {
    loadLeads();
  }, [leadFilters, stages.length]);

  const contractTotalPages = Math.ceil(contractTotal / contractPageSize) || 1;

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order_index - b.order_index), [stages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatórios Comerciais</h1>
          <p className="text-sm text-gray-500">Visão completa dos contratos e do funil de vendas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('gerencial')}
            className={`px-4 py-2 text-sm rounded-lg border ${
              activeTab === 'gerencial'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Relatório Gerencial
          </button>
          <button
            onClick={() => setActiveTab('vendas')}
            className={`px-4 py-2 text-sm rounded-lg border ${
              activeTab === 'vendas'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Relatórios de Vendas
          </button>
        </div>
      </div>

      {activeTab === 'gerencial' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText size={16} />
                Contratos comerciais
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadExport('excel', 'gerencial')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                  disabled={exporting === 'excel-gerencial'}
                >
                  {exporting === 'excel-gerencial' ? 'Gerando...' : 'Baixar Excel'}
                </button>
                <button
                  onClick={() => downloadExport('pdf', 'gerencial')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                  disabled={exporting === 'pdf-gerencial'}
                >
                  {exporting === 'pdf-gerencial' ? 'Gerando...' : 'Baixar PDF'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Busca livre</label>
                <input
                  value={contractFilters.search}
                  onChange={(e) => setContractFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Nome, CNPJ, e-mail"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status do contrato</label>
                <select
                  value={contractFilters.status}
                  onChange={(e) => setContractFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="vencendo">Vencendo</option>
                  <option value="encerrado">Encerrado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor (mín / máx)</label>
                <div className="flex gap-2">
                  <input
                    value={contractFilters.amountMin}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, amountMin: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    value={contractFilters.amountMax}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, amountMax: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Início do contrato</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={contractFilters.startFrom}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, startFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={contractFilters.startTo}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, startTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Término do contrato</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={contractFilters.endFrom}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, endFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={contractFilters.endTo}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, endTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Produtos</label>
                <select
                  multiple
                  value={contractFilters.products}
                  onChange={(e) =>
                    setContractFilters((prev) => ({
                      ...prev,
                      products: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white h-[96px]"
                >
                  {productsOptions.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pacotes</label>
                <select
                  multiple
                  value={contractFilters.packageIds}
                  onChange={(e) =>
                    setContractFilters((prev) => ({
                      ...prev,
                      packageIds: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white h-[96px]"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">{contractTotal} contrato(s)</p>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={contractSort.field}
                  onChange={(e) => setContractSort((prev) => ({ ...prev, field: e.target.value }))}
                  className="px-2 py-1 border border-gray-200 rounded bg-white"
                >
                  <option value="end_date">Ordenar por término</option>
                  <option value="start_date">Ordenar por início</option>
                  <option value="amount_cents">Ordenar por valor</option>
                  <option value="status">Ordenar por status</option>
                </select>
                <button
                  onClick={() => setContractSort((prev) => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
                  className="px-2 py-1 border border-gray-200 rounded"
                >
                  {contractSort.dir === 'asc' ? 'Asc' : 'Desc'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-500">
                  <tr className="text-left">
                    <th className="py-2 px-2">Clínica</th>
                    <th className="py-2 px-2">CNPJ</th>
                    <th className="py-2 px-2">Produto(s)</th>
                    <th className="py-2 px-2">Pacote</th>
                    <th className="py-2 px-2">Valor</th>
                    <th className="py-2 px-2">Início</th>
                    <th className="py-2 px-2">Término</th>
                    <th className="py-2 px-2">Dias p/ vencimento</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Responsável</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {contractsLoading ? (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-gray-400">
                        <Loader2 size={18} className="animate-spin inline-block mr-2" /> Carregando...
                      </td>
                    </tr>
                  ) : contracts.length ? (
                    contracts.map((contract) => {
                      const days = getDaysToEnd(contract.end_date);
                      return (
                        <tr key={contract.id} className="border-t border-gray-100">
                          <td className="py-2 px-2 font-medium text-gray-700">{contract.clinics?.name || '-'}</td>
                          <td className="py-2 px-2 text-gray-500">{contract.clinics?.documento || '-'}</td>
                          <td className="py-2 px-2 text-gray-500">
                            {(contract.products || []).join(', ') || '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-500">{contract.package?.name || '-'}</td>
                          <td className="py-2 px-2 text-gray-700">
                            {contract.amount_cents !== null && contract.amount_cents !== undefined
                              ? formatCurrency(contract.amount_cents / 100)
                              : '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-500">{contract.start_date ? formatDate(contract.start_date) : '-'}</td>
                          <td className="py-2 px-2 text-gray-500">{contract.end_date ? formatDate(contract.end_date) : '-'}</td>
                          <td className="py-2 px-2 text-gray-500">{days !== null ? days : '-'}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(contract.status)}`}>
                              {contract.status || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-gray-500">
                            {contract.owner_user_id ? internalUsersMap.get(contract.owner_user_id) || contract.owner_user_id : '-'}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              onClick={() => setSelectedContract(contract)}
                              className="text-brand-600 hover:text-brand-700"
                            >
                              Ver detalhes
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-gray-400">
                        Nenhum contrato encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
              <span>
                Página {contractPage} de {contractTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 border border-gray-200 rounded disabled:opacity-50"
                  onClick={() => setContractPage((prev) => Math.max(1, prev - 1))}
                  disabled={contractPage === 1}
                >
                  Anterior
                </button>
                <button
                  className="px-2 py-1 border border-gray-200 rounded disabled:opacity-50"
                  onClick={() => setContractPage((prev) => Math.min(contractTotalPages, prev + 1))}
                  disabled={contractPage >= contractTotalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vendas' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Settings size={16} />
                Funil de vendas
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openLeadModal()}
                  className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                >
                  <Plus size={16} /> Novo lead
                </button>
                <button
                  onClick={() => setStageManagerOpen(true)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                >
                  Gerenciar etapas
                </button>
                <button
                  onClick={() => downloadExport('excel', 'vendas')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                  disabled={exporting === 'excel-vendas'}
                >
                  {exporting === 'excel-vendas' ? 'Gerando...' : 'Baixar Excel'}
                </button>
                <button
                  onClick={() => downloadExport('pdf', 'vendas')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                  disabled={exporting === 'pdf-vendas'}
                >
                  {exporting === 'pdf-vendas' ? 'Gerando...' : 'Baixar PDF'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Busca livre</label>
                <input
                  value={leadFilters.search}
                  onChange={(e) => setLeadFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Nome, empresa, e-mail, telefone"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={leadFilters.status}
                  onChange={(e) => setLeadFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="ganho">Ganho</option>
                  <option value="perdido">Perdido</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
                <select
                  value={leadFilters.owner}
                  onChange={(e) => setLeadFilters((prev) => ({ ...prev, owner: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Todos</option>
                  {internalUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Origem</label>
                <select
                  value={leadFilters.source}
                  onChange={(e) => setLeadFilters((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {sourcesOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data de criação</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={leadFilters.createdFrom}
                    onChange={(e) => setLeadFilters((prev) => ({ ...prev, createdFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={leadFilters.createdTo}
                    onChange={(e) => setLeadFilters((prev) => ({ ...prev, createdTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor potencial</label>
                <div className="flex gap-2">
                  <input
                    value={leadFilters.valueMin}
                    onChange={(e) => setLeadFilters((prev) => ({ ...prev, valueMin: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    value={leadFilters.valueMax}
                    onChange={(e) => setLeadFilters((prev) => ({ ...prev, valueMax: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Limite PDF</label>
                <input
                  value={leadPdfLimit}
                  onChange={(e) => setLeadPdfLimit(e.target.value)}
                  placeholder="200"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4">
            {leadsLoading ? (
              <div className="flex items-center justify-center text-gray-400 py-10">
                <Loader2 size={18} className="animate-spin mr-2" /> Carregando funil...
              </div>
            ) : (
              <DndContext onDragEnd={handleDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {sortedStages.map((stage) => (
                    <StageColumn
                      key={stage.id}
                      stage={stage}
                      leads={leadsByStage.get(stage.id) || []}
                      onOpenLead={openLeadModal}
                      onActivity={(lead) => openActivityModal(lead)}
                      onFollowUp={(lead) => openActivityModal(lead, true)}
                      onWon={markLeadWon}
                      onLost={markLeadLost}
                    />
                  ))}
                </div>
              </DndContext>
            )}
          </div>
        </div>
      )}

      {selectedContract && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedContract(null)}>
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Detalhes do contrato</h3>
              <button onClick={() => setSelectedContract(null)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Clínica</p>
                <p className="font-medium text-gray-800">{selectedContract.clinics?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CNPJ</p>
                <p className="font-medium text-gray-800">{selectedContract.clinics?.documento || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Produtos</p>
                <p className="font-medium text-gray-800">{(selectedContract.products || []).join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pacote</p>
                <p className="font-medium text-gray-800">{selectedContract.package?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Valor</p>
                <p className="font-medium text-gray-800">
                  {selectedContract.amount_cents !== null && selectedContract.amount_cents !== undefined
                    ? formatCurrency(selectedContract.amount_cents / 100)
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-medium text-gray-800">{selectedContract.status || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Início</p>
                <p className="font-medium text-gray-800">{selectedContract.start_date ? formatDate(selectedContract.start_date) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Término</p>
                <p className="font-medium text-gray-800">{selectedContract.end_date ? formatDate(selectedContract.end_date) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Responsável interno</p>
                <p className="font-medium text-gray-800">
                  {selectedContract.owner_user_id
                    ? internalUsersMap.get(selectedContract.owner_user_id) || selectedContract.owner_user_id
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Dias para vencimento</p>
                <p className="font-medium text-gray-800">{getDaysToEnd(selectedContract.end_date) ?? '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {leadModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setLeadModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{editingLead ? 'Editar lead' : 'Novo lead'}</h3>
              <button onClick={() => setLeadModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Empresa/Clínica</label>
                <input
                  value={leadForm.company_name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da clínica candidata</label>
                <input
                  value={leadForm.tenant_candidate_name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, tenant_candidate_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                <input
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                <input
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                <input
                  value={leadForm.whatsapp}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Origem</label>
                <input
                  value={leadForm.source}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
                <select
                  value={leadForm.owner_user_id}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, owner_user_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Selecione...</option>
                  {internalUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor potencial (R$)</label>
                <input
                  value={leadForm.value_potential}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, value_potential: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
                <select
                  value={leadForm.current_stage_id}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, current_stage_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {sortedStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={leadForm.status}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="ativo">Ativo</option>
                  <option value="ganho">Ganho</option>
                  <option value="perdido">Perdido</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setLeadModalOpen(false)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveLead}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {activityModalOpen && activityLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setActivityModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Registrar atividade</h3>
              <button onClick={() => setActivityModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  value={activityForm.type}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="call">Ligação</option>
                  <option value="msg">Mensagem</option>
                  <option value="meeting">Reunião</option>
                  <option value="note">Nota</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Próximo follow-up</label>
                <input
                  type="datetime-local"
                  value={activityForm.next_follow_up_at}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, next_follow_up_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActivityModalOpen(false)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveActivity}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sequenceModalOpen && sequenceLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSequenceModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Sequência de comunicação</h3>
              <button onClick={() => setSequenceModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select
                  value={sequenceForm.channel}
                  onChange={(e) => setSequenceForm((prev) => ({ ...prev, channel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
                <input
                  value={sequenceForm.template}
                  onChange={(e) => setSequenceForm((prev) => ({ ...prev, template: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Agendar para</label>
                <input
                  type="datetime-local"
                  value={sequenceForm.scheduled_at}
                  onChange={(e) => setSequenceForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={sequenceForm.status}
                  onChange={(e) => setSequenceForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="pending">Pendente</option>
                  <option value="sent">Enviado</option>
                  <option value="failed">Falhou</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSequenceModalOpen(false)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveSequence}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stageManagerOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setStageManagerOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Etapas do funil</h3>
              <button onClick={() => setStageManagerOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {sortedStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <input
                    defaultValue={stage.name}
                    onBlur={(e) => renameStage(stage, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    disabled={stage.is_archived_stage}
                  />
                  <button
                    onClick={() => moveStage(stage, 'up')}
                    className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40"
                    disabled={index === 0 || stage.is_archived_stage}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStage(stage, 'down')}
                    className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40"
                    disabled={index === sortedStages.length - 1 || stage.is_archived_stage}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteStage(stage)}
                    className="px-2 py-1 text-xs text-red-600 border border-red-100 rounded disabled:opacity-40"
                    disabled={stage.is_archived_stage}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nova etapa</label>
                <div className="flex gap-2">
                  <input
                    placeholder="Nome da etapa"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      addStage((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                  <button
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
                      if (!input) return;
                      addStage(input.value);
                      input.value = '';
                    }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default AdminCommercialReports;
