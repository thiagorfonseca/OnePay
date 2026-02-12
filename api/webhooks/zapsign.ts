import { readJson, json, methodNotAllowed } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';
import { ZAPSIGN_WEBHOOK_SECRET } from '../_utils/env';

const mapStatus = (value?: string | null) => {
  const raw = (value || '').toLowerCase();
  if (raw.includes('signed')) return 'signed';
  if (raw.includes('rejected')) return 'rejected';
  if (raw.includes('canceled') || raw.includes('cancelled')) return 'canceled';
  if (raw.includes('sent')) return 'sent';
  if (raw.includes('created')) return 'created';
  return 'created';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJson(req);

    if (ZAPSIGN_WEBHOOK_SECRET) {
      const headerSecret =
        req.headers['x-webhook-secret'] ||
        req.headers['x-zapsign-secret'] ||
        req.headers['x-zapsign-webhook-secret'] ||
        body?.secret;
      if (headerSecret !== ZAPSIGN_WEBHOOK_SECRET) {
        return json(res, 200, { ok: true });
      }
    }

    const docId =
      body?.doc_id ||
      body?.document_id ||
      body?.document?.id ||
      body?.id ||
      body?.data?.doc_id ||
      body?.data?.id;

    if (!docId) return json(res, 200, { ok: true });

    const rawStatus = body?.status || body?.event || body?.data?.status || body?.data?.event;
    const status = mapStatus(rawStatus);

    const { data: updated } = await supabaseAdmin
      .from('od_zapsign_documents')
      .update({
        status,
        signed_at: status === 'signed' ? new Date().toISOString() : null,
        raw: body,
      })
      .eq('zapsign_doc_id', docId)
      .select('proposal_id')
      .maybeSingle();

    if (updated?.proposal_id) {
      const proposalStatus = status === 'signed' ? 'signed' : status === 'rejected' || status === 'canceled' ? 'canceled' : null;
      if (proposalStatus) {
        await supabaseAdmin.from('od_proposals').update({ status: proposalStatus }).eq('id', updated.proposal_id);
      }
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(res, 200, { ok: true });
  }
}
