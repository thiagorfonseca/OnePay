import { supabaseAdmin } from './supabase';

const INTERNAL_ROLES = new Set(['system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales']);

export const requireInternalUser = async (req: any) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (!authHeader.toString().startsWith('Bearer ')) return null;
  const token = authHeader.toString().replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const role = profile?.role || null;
  if (!role || !INTERNAL_ROLES.has(role)) return null;
  return { userId, role };
};
