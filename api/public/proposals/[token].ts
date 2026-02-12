import { json, methodNotAllowed, notFound, badRequest } from '../../_utils/http';
import { supabaseAdmin } from '../../_utils/supabase';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const token = req.query?.token as string;
  if (!token) return badRequest(res, 'Token ausente.');

  const { data: proposal } = await supabaseAdmin
    .from('od_proposals')
    .select('id, title, product_type, amount_cents, payment_methods, installments, requires_signature, confirmation_text, status, public_token, expires_at')
    .eq('public_token', token)
    .maybeSingle();

  if (!proposal) return notFound(res, 'Proposta não encontrada.');
  if (proposal.expires_at && new Date(proposal.expires_at).getTime() < Date.now()) {
    return badRequest(res, 'Proposta expirada.');
  }

  return json(res, 200, {
    proposal,
  });
}
