import { readJson, json, methodNotAllowed, badRequest, serverError, unauthorized } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';
import { APP_BASE_URL, RESEND_API_KEY, RESEND_FROM } from '../_utils/env';
import { requireInternalUser } from '../_utils/auth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const internal = await requireInternalUser(req);
  if (!internal) return unauthorized(res, 'Acesso negado.');

  try {
    const body = await readJson(req);
    const proposalId = body?.proposalId as string | undefined;
    const token = body?.token as string | undefined;
    const to = body?.to as string | undefined;

    if (!proposalId && !token) return badRequest(res, 'Informe proposalId ou token.');
    if (!to) return badRequest(res, 'Informe o e-mail de destino.');

    const query = supabaseAdmin
      .from('od_proposals')
      .select('id, title, public_token')
      .limit(1);

    const { data: proposal } = proposalId
      ? await query.eq('id', proposalId).maybeSingle()
      : await query.eq('public_token', token as string).maybeSingle();

    if (!proposal) return badRequest(res, 'Proposta não encontrada.');

    const link = `${APP_BASE_URL || ''}/cadastro/${proposal.public_token}`;

    if (!RESEND_API_KEY || !RESEND_FROM) {
      return badRequest(res, 'Configuração de e-mail ausente.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: proposal.title || 'Proposta OneDoctor',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>Proposta OneDoctor</h2>
            <p>Olá! Para concluir o cadastro, acesse o link abaixo:</p>
            <p><a href="${link}">${link}</a></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.message || 'Falha ao enviar e-mail.');
    }

    return json(res, 200, { ok: true, link });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao enviar e-mail.', err?.message);
  }
}
