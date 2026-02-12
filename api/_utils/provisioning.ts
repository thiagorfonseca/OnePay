import { supabaseAdmin } from './supabase';

const normalizeCnpj = (cnpj?: string | null) => (cnpj || '').replace(/\D/g, '');

const getLatestSubmission = async (proposalId: string) => {
  const { data } = await supabaseAdmin
    .from('od_proposal_form_submissions')
    .select('payload, submitted_at')
    .eq('proposal_id', proposalId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.payload || null;
};

const ensureClinic = async (payload: any) => {
  const cnpj = normalizeCnpj(payload?.company?.cnpj || payload?.company?.documento || payload?.company?.cnpj_cpf);
  let clinic = null;

  if (cnpj) {
    const { data } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .eq('documento', cnpj)
      .maybeSingle();
    clinic = data || null;
  }

  if (!clinic) {
    const { data } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: payload?.company?.trade_name || payload?.company?.legal_name || 'Nova Clínica',
        documento: cnpj || null,
        responsavel_nome: payload?.responsible?.name || null,
        email_contato: payload?.company?.email_principal || payload?.responsible?.email || null,
        telefone_contato: payload?.company?.telefone || payload?.responsible?.telefone || null,
        ativo: true,
      })
      .select('*')
      .single();
    clinic = data || null;
  }

  return clinic;
};

const ensureAuthUser = async (email?: string | null, fullName?: string | null) => {
  if (!email) return null;

  const { data: existing, error: existingError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
  if (!existingError && existing?.user?.id) return existing.user;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });

  if (error) throw error;
  return data.user;
};

const ensureClinicUser = async (clinicId: string, userId: string | null, payload: any) => {
  if (!clinicId || !userId) return null;
  const name = payload?.responsible?.name || payload?.company?.legal_name || 'Responsável';
  const email = payload?.responsible?.email || payload?.company?.email_principal || null;

  const { data } = await supabaseAdmin
    .from('clinic_users')
    .upsert(
      {
        clinic_id: clinicId,
        user_id: userId,
        name,
        email,
        role: 'owner',
        ativo: true,
      },
      { onConflict: 'clinic_id,user_id' }
    )
    .select('*')
    .maybeSingle();

  return data || null;
};

const ensureClinicPackage = async (clinicId: string, packageId: string | null) => {
  if (!clinicId || !packageId) return null;
  const { data } = await supabaseAdmin
    .from('clinic_packages')
    .upsert(
      { clinic_id: clinicId, package_id: packageId },
      { onConflict: 'clinic_id,package_id' }
    )
    .select('*')
    .maybeSingle();
  return data || null;
};

const ensureEntitlement = async (clinicId: string, userId: string | null, packageId: string | null) => {
  if (!clinicId) return null;

  const { data: existing } = await supabaseAdmin
    .from('od_entitlements')
    .select('*')
    .eq('tenant_id', clinicId)
    .eq('user_id', userId)
    .eq('package_id', packageId)
    .maybeSingle();

  if (existing) return existing;

  const products: any[] = [];

  if (packageId) {
    const { data: pkg } = await supabaseAdmin
      .from('content_packages')
      .select('pages')
      .eq('id', packageId)
      .maybeSingle();
    if (pkg?.pages) products.push(...pkg.pages);
  }

  const { data } = await supabaseAdmin
    .from('od_entitlements')
    .insert({
      tenant_id: clinicId,
      user_id: userId,
      package_id: packageId,
      products,
      status: 'active',
      starts_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();
  return data || null;
};

export const provisionForProposal = async (proposalId: string) => {
  const { data: proposal } = await supabaseAdmin
    .from('od_proposals')
    .select('id, status, package_id')
    .eq('id', proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false, reason: 'proposal_not_found' };
  if (proposal.status === 'provisioned') return { ok: true, already: true };

  const payload = await getLatestSubmission(proposalId);
  if (!payload) return { ok: false, reason: 'payload_not_found' };

  const clinic = await ensureClinic(payload);
  if (!clinic) return { ok: false, reason: 'clinic_error' };

  const user = await ensureAuthUser(payload?.responsible?.email, payload?.responsible?.name);
  await ensureClinicUser(clinic.id, user?.id || null, payload);
  await ensureClinicPackage(clinic.id, proposal.package_id || null);
  await ensureEntitlement(clinic.id, user?.id || null, proposal.package_id || null);

  await supabaseAdmin
    .from('od_proposals')
    .update({ status: 'provisioned' })
    .eq('id', proposalId);

  return { ok: true, clinicId: clinic.id, userId: user?.id || null };
};
