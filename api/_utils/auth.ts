import { supabaseAdmin } from './supabase';

const INTERNAL_ROLES = new Set(['system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales']);

const parseBearerToken = (req: any) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (!authHeader.toString().startsWith('Bearer ')) return null;
  const token = authHeader.toString().replace('Bearer ', '').trim();
  return token || null;
};

export const resolveAuthUser = async (req: any) => {
  const token = parseBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, token };
};

export const requireInternalUser = async (req: any) => {
  const auth = await resolveAuthUser(req);
  if (!auth) return null;
  const userId = auth.userId;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const role = profile?.role || null;
  if (!role || !INTERNAL_ROLES.has(role)) return null;
  return { userId, role };
};

export const requireClinicAccess = async (req: any, clinicId: string) => {
  if (!clinicId) return null;
  const auth = await resolveAuthUser(req);
  if (!auth) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, clinic_id')
    .eq('id', auth.userId)
    .maybeSingle();

  const role = profile?.role || null;
  if (role && INTERNAL_ROLES.has(role)) {
    return { userId: auth.userId, role, clinicId: profile?.clinic_id || null, isInternal: true };
  }

  if (profile?.clinic_id && profile.clinic_id === clinicId) {
    return { userId: auth.userId, role, clinicId: profile.clinic_id, isInternal: false };
  }

  const { data: clinicUser } = await supabaseAdmin
    .from('clinic_users')
    .select('user_id')
    .eq('clinic_id', clinicId)
    .eq('user_id', auth.userId)
    .eq('ativo', true)
    .maybeSingle();

  if (!clinicUser) return null;
  return { userId: auth.userId, role, clinicId, isInternal: false };
};
