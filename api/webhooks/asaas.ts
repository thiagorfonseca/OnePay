import { readJson, json, methodNotAllowed } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';
import { ASAAS_WEBHOOK_TOKEN } from '../_utils/env';
import { provisionForProposal } from '../_utils/provisioning';

const mapStatus = (value?: string | null) => {
  const raw = (value || '').toUpperCase();
  if (['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'PAID'].includes(raw)) return 'paid';
  if (['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(raw)) return 'pending';
  if (['OVERDUE'].includes(raw)) return 'overdue';
  if (['CANCELED', 'CANCELLED'].includes(raw)) return 'canceled';
  if (['REFUNDED'].includes(raw)) return 'refunded';
  return 'created';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const headerToken = req.headers['asaas-access-token'] || req.headers['Asaas-Access-Token'];
  if (ASAAS_WEBHOOK_TOKEN && headerToken !== ASAAS_WEBHOOK_TOKEN) {
    return json(res, 200, { ok: true });
  }

  try {
    const body = await readJson(req);
    const payment = body?.payment || body?.data?.payment || body?.data || body;
    const paymentId = payment?.id || payment?.payment?.id;
    if (!paymentId) return json(res, 200, { ok: true });

    const status = mapStatus(payment?.status);

    const { data: existing } = await supabaseAdmin
      .from('od_asaas_payments')
      .select('proposal_id')
      .eq('asaas_payment_id', paymentId)
      .maybeSingle();

    if (existing?.proposal_id) {
      await supabaseAdmin
        .from('od_asaas_payments')
        .update({
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          raw: body,
        })
        .eq('asaas_payment_id', paymentId);

      if (status === 'paid') {
        await supabaseAdmin
          .from('od_proposals')
          .update({ status: 'paid' })
          .eq('id', existing.proposal_id);
        await provisionForProposal(existing.proposal_id);
      }
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(res, 200, { ok: true });
  }
}
