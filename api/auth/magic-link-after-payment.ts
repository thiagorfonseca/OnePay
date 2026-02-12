import { json, methodNotAllowed, badRequest, notFound, serverError } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';
import { APP_BASE_URL } from '../_utils/env';
import { provisionForProposal } from '../_utils/provisioning';

const loadLatestPayload = async (proposalId: string) => {
  const { data } = await supabaseAdmin
    .from('od_proposal_form_submissions')
    .select('payload')
    .eq('proposal_id', proposalId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.payload || null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const token = req.query?.token as string;
  if (!token) return badRequest(res, 'Token ausente.');

  try {
    const { data: proposal } = await supabaseAdmin
      .from('od_proposals')
      .select('id, status, client_id')
      .eq('public_token', token)
      .maybeSingle();

    if (!proposal) return notFound(res, 'Proposta não encontrada.');

    const { data: payment } = await supabaseAdmin
      .from('od_asaas_payments')
      .select('status')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment || payment.status !== 'paid') {
      return badRequest(res, 'Pagamento ainda não confirmado.');
    }

    await provisionForProposal(proposal.id);

    const payload = await loadLatestPayload(proposal.id);
    const email = payload?.responsible?.email || payload?.company?.email_principal || null;
    if (!email) return badRequest(res, 'Email do usuário não encontrado.');

    const redirectTo = `${APP_BASE_URL || ''}/app/onboarding/boas-vindas`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) throw error;

    const actionLink = (data as any)?.properties?.action_link || (data as any)?.action_link || null;
    if (!actionLink) return serverError(res, 'Falha ao gerar link de acesso.');

    return json(res, 200, { url: actionLink });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao gerar magic link.', err?.message);
  }
}
