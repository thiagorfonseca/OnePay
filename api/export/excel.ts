import { buildSpreadsheetXml, type SpreadsheetCell } from '../_utils/excel';
import { requireInternalUser } from '../_utils/auth';
import { badRequest, methodNotAllowed, serverError, unauthorized } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';

const toArray = (value?: string | string[]) => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getQueryValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || '';

const parseCents = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
};

const formatCurrency = (value?: number | null) => {
  if (!value && value !== 0) return '';
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const resolveClinicIds = async (search: string) => {
  const term = search.trim();
  if (!term) return null;
  const { data } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .or(`name.ilike.%${term}%,documento.ilike.%${term}%,email_contato.ilike.%${term}%`);
  const ids = (data || []).map((row: any) => row.id).filter(Boolean);
  return ids.length ? ids : [];
};

const loadContracts = async (filters: Record<string, string | string[] | undefined>) => {
  const packageIds = toArray(filters.package_ids);
  const products = toArray(filters.products);
  const status = getQueryValue(filters.status);
  const search = getQueryValue(filters.search);
  const startFrom = getQueryValue(filters.start_from);
  const startTo = getQueryValue(filters.start_to);
  const endFrom = getQueryValue(filters.end_from);
  const endTo = getQueryValue(filters.end_to);
  const amountMin = parseCents(getQueryValue(filters.amount_min));
  const amountMax = parseCents(getQueryValue(filters.amount_max));

  let query = supabaseAdmin
    .from('commercial_contracts')
    .select(
      `id, clinic_id, products, package_id, amount_cents, start_date, end_date, status, owner_user_id,
       clinics:clinics (id, name, documento, email_contato),
       package:content_packages (id, name)`,
    )
    .order('end_date', { ascending: true, nullsFirst: false });

  if (status) query = query.eq('status', status);
  if (startFrom) query = query.gte('start_date', startFrom);
  if (startTo) query = query.lte('start_date', startTo);
  if (endFrom) query = query.gte('end_date', endFrom);
  if (endTo) query = query.lte('end_date', endTo);
  if (amountMin !== null) query = query.gte('amount_cents', amountMin);
  if (amountMax !== null) query = query.lte('amount_cents', amountMax);
  if (packageIds.length) query = query.in('package_id', packageIds);
  if (products.length) query = query.overlaps('products', products);

  if (search) {
    const clinicIds = await resolveClinicIds(search);
    if (clinicIds && clinicIds.length === 0) return [];
    if (clinicIds && clinicIds.length) query = query.in('clinic_id', clinicIds);
  }

  const { data } = await query;
  return (data || []) as any[];
};

const loadLeads = async (filters: Record<string, string | string[] | undefined>) => {
  const status = getQueryValue(filters.status);
  const owner = getQueryValue(filters.owner);
  const source = getQueryValue(filters.source);
  const search = getQueryValue(filters.search);
  const createdFrom = getQueryValue(filters.created_from);
  const createdTo = getQueryValue(filters.created_to);
  const valueMin = parseCents(getQueryValue(filters.value_min));
  const valueMax = parseCents(getQueryValue(filters.value_max));

  let query = supabaseAdmin
    .from('sales_leads')
    .select(
      `id, name, company_name, tenant_candidate_name, email, phone, whatsapp, source, owner_user_id,
       value_potential_cents, status, current_stage_id, last_interaction_at, next_follow_up_at, created_at,
       stage:sales_stages (id, name, order_index, is_archived_stage)`
    )
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (owner) query = query.eq('owner_user_id', owner);
  if (source) query = query.eq('source', source);
  if (createdFrom) query = query.gte('created_at', createdFrom);
  if (createdTo) query = query.lte('created_at', createdTo);
  if (valueMin !== null) query = query.gte('value_potential_cents', valueMin);
  if (valueMax !== null) query = query.lte('value_potential_cents', valueMax);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,company_name.ilike.%${search}%,tenant_candidate_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,whatsapp.ilike.%${search}%`
    );
  }

  const { data } = await query;
  return (data || []) as any[];
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const user = await requireInternalUser(req);
    if (!user) return unauthorized(res, 'Acesso não autorizado.');

    const type = getQueryValue(req.query?.type);
    if (!type) return badRequest(res, 'Tipo de exportação inválido.');

    if (type === 'gerencial') {
      const data = await loadContracts(req.query || {});
      const ownerIds = Array.from(new Set(data.map((row) => row?.owner_user_id).filter(Boolean)));
      let ownerMap = new Map<string, string>();
      if (ownerIds.length) {
        const { data: owners } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        ownerMap = new Map((owners || []).map((item: any) => [item.id, item.full_name || item.id]));
      }
      const rows: SpreadsheetCell[][] = [
        [
          { type: 'String', value: 'Clínica' },
          { type: 'String', value: 'CNPJ' },
          { type: 'String', value: 'Produtos' },
          { type: 'String', value: 'Pacote' },
          { type: 'String', value: 'Valor' },
          { type: 'String', value: 'Início' },
          { type: 'String', value: 'Término' },
          { type: 'String', value: 'Status' },
          { type: 'String', value: 'Responsável' },
        ],
      ];
      data.forEach((row) => {
        rows.push([
          { type: 'String', value: row?.clinics?.name || '-' },
          { type: 'String', value: row?.clinics?.documento || '-' },
          { type: 'String', value: Array.isArray(row?.products) ? row.products.join(', ') : '' },
          { type: 'String', value: row?.package?.name || '-' },
          { type: 'String', value: formatCurrency(row?.amount_cents) },
          { type: 'String', value: formatDate(row?.start_date) },
          { type: 'String', value: formatDate(row?.end_date) },
          { type: 'String', value: row?.status || '-' },
          { type: 'String', value: row?.owner_user_id ? ownerMap.get(row.owner_user_id) || row.owner_user_id : '-' },
        ]);
      });
      const xml = buildSpreadsheetXml('Relatorio Gerencial', rows);
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-gerencial.xls"');
      res.statusCode = 200;
      res.end(xml);
      return;
    }

    if (type === 'vendas') {
      const data = await loadLeads(req.query || {});
      const ownerIds = Array.from(new Set(data.map((row) => row?.owner_user_id).filter(Boolean)));
      let ownerMap = new Map<string, string>();
      if (ownerIds.length) {
        const { data: owners } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        ownerMap = new Map((owners || []).map((item: any) => [item.id, item.full_name || item.id]));
      }
      const rows: SpreadsheetCell[][] = [
        [
          { type: 'String', value: 'Lead' },
          { type: 'String', value: 'Empresa/Clínica' },
          { type: 'String', value: 'Email' },
          { type: 'String', value: 'Telefone' },
          { type: 'String', value: 'WhatsApp' },
          { type: 'String', value: 'Origem' },
          { type: 'String', value: 'Valor potencial' },
          { type: 'String', value: 'Status' },
          { type: 'String', value: 'Etapa' },
          { type: 'String', value: 'Responsável' },
          { type: 'String', value: 'Próx. follow-up' },
        ],
      ];
      data.forEach((row) => {
        rows.push([
          { type: 'String', value: row?.name || '-' },
          { type: 'String', value: row?.company_name || row?.tenant_candidate_name || '-' },
          { type: 'String', value: row?.email || '-' },
          { type: 'String', value: row?.phone || '-' },
          { type: 'String', value: row?.whatsapp || '-' },
          { type: 'String', value: row?.source || '-' },
          { type: 'String', value: formatCurrency(row?.value_potential_cents) },
          { type: 'String', value: row?.status || '-' },
          { type: 'String', value: row?.stage?.name || '-' },
          { type: 'String', value: row?.owner_user_id ? ownerMap.get(row.owner_user_id) || row.owner_user_id : '-' },
          { type: 'String', value: formatDate(row?.next_follow_up_at) },
        ]);
      });
      const xml = buildSpreadsheetXml('Relatorio Vendas', rows);
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-vendas.xls"');
      res.statusCode = 200;
      res.end(xml);
      return;
    }

    return badRequest(res, 'Tipo de exportação inválido.');
  } catch (error: any) {
    return serverError(res, 'Erro ao exportar.', error?.message);
  }
}
