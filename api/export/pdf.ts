import { buildPdfFromHtml } from '../_utils/pdf';
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

const buildGerencialHtml = (rows: any[], ownerMap: Map<string, string>) => {
  const lines = rows.map((row) => {
    const clinic = row?.clinics?.name || '-';
    const cnpj = row?.clinics?.documento || '-';
    const products = Array.isArray(row?.products) ? row.products.join(', ') : '-';
    const pack = row?.package?.name || '-';
    const amount = formatCurrency(row?.amount_cents);
    const start = formatDate(row?.start_date);
    const end = formatDate(row?.end_date);
    const status = row?.status || '-';
    const owner = row?.owner_user_id ? ownerMap.get(row.owner_user_id) || row.owner_user_id : '-';
    return `<p><strong>${clinic}</strong> • ${cnpj}<br/>Produtos: ${products}<br/>Pacote: ${pack}<br/>Valor: ${amount}<br/>Início: ${start} • Término: ${end} • Status: ${status}<br/>Responsável: ${owner}</p>`;
  });

  return `
    <h2>Relatório Gerencial</h2>
    <p>Total de contratos: ${rows.length}</p>
    ${lines.join('')}
  `;
};

const buildVendasHtml = (rows: any[], listRows: any[], ownerMap: Map<string, string>) => {
  const summaryMap = new Map<string, { count: number; value: number }>();
  rows.forEach((lead) => {
    const stage = lead?.stage?.name || 'Sem etapa';
    const value = Number(lead?.value_potential_cents || 0);
    const prev = summaryMap.get(stage) || { count: 0, value: 0 };
    summaryMap.set(stage, { count: prev.count + 1, value: prev.value + value });
  });
  const summaryLines = Array.from(summaryMap.entries())
    .map(([stage, info]) => `<p><strong>${stage}</strong>: ${info.count} lead(s) • ${formatCurrency(info.value)}</p>`)
    .join('');

  const listLines = listRows.map((lead) => {
    const name = lead?.name || '-';
    const company = lead?.company_name || lead?.tenant_candidate_name || '-';
    const contact = lead?.email || lead?.phone || lead?.whatsapp || '-';
    const stage = lead?.stage?.name || '-';
    const status = lead?.status || '-';
    const value = formatCurrency(lead?.value_potential_cents);
    const next = formatDate(lead?.next_follow_up_at);
    const owner = lead?.owner_user_id ? ownerMap.get(lead.owner_user_id) || lead.owner_user_id : '-';
    return `<p><strong>${name}</strong> • ${company}<br/>Contato: ${contact}<br/>Etapa: ${stage} • Status: ${status} • Valor: ${value}<br/>Responsável: ${owner}<br/>Próx. follow-up: ${next}</p>`;
  });

  return `
    <h2>Relatórios de Vendas</h2>
    <h3>Resumo do funil</h3>
    ${summaryLines}
    <h3>Leads</h3>
    ${listLines.join('')}
  `;
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
      const html = buildGerencialHtml(data, ownerMap);
      const pdfBase64 = await buildPdfFromHtml(html);
      const buffer = Buffer.from(pdfBase64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-gerencial.pdf"');
      res.statusCode = 200;
      res.end(buffer);
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
      const limitRaw = getQueryValue(req.query?.limit);
      const limit = limitRaw ? Math.max(1, Number(limitRaw)) : null;
      const limited = limit && Number.isFinite(limit) ? data.slice(0, limit) : data;
      const html = buildVendasHtml(data, limited, ownerMap);
      const pdfBase64 = await buildPdfFromHtml(html);
      const buffer = Buffer.from(pdfBase64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-vendas.pdf"');
      res.statusCode = 200;
      res.end(buffer);
      return;
    }

    return badRequest(res, 'Tipo de exportação inválido.');
  } catch (error: any) {
    return serverError(res, 'Erro ao exportar.', error?.message);
  }
}
