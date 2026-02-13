import { readJson, json, methodNotAllowed, badRequest, notFound, serverError, unauthorized } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';
import { requireClinicAccess } from '../_utils/auth';
import { RESEND_API_KEY, RESEND_FROM } from '../_utils/env';
import { buildPdfFromHtml } from '../_utils/pdf';
import { buildArchetypeEmailHtml, buildArchetypeResultHtml } from '../_utils/archetypeReport';

const toFileSafeName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJson(req);
    const respondentId = body?.respondentId || body?.id;
    if (!respondentId) return badRequest(res, 'Informe respondentId.');

    const { data: respondent, error } = await supabaseAdmin
      .from('archetype_respondents')
      .select('id, name, email, phone, scores, top_profile, top_profiles, created_at, clinic_id')
      .eq('id', respondentId)
      .maybeSingle();

    if (error) throw error;
    if (!respondent) return notFound(res, 'Respondente não encontrado.');

    const access = await requireClinicAccess(req, respondent.clinic_id);
    if (!access) return unauthorized(res, 'Acesso negado.');

    const to = body?.to || respondent.email;
    if (!to) return badRequest(res, 'E-mail do respondente não encontrado.');

    if (!RESEND_API_KEY || !RESEND_FROM) {
      return badRequest(res, 'Configuração de e-mail ausente.');
    }

    const html = buildArchetypeResultHtml(respondent);
    const pdfBase64 = await buildPdfFromHtml(html);
    const emailHtml = buildArchetypeEmailHtml(respondent);
    const fileName = toFileSafeName(respondent.name || 'respondente') || 'respondente';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: `Resultado do Teste de Perfil${respondent.name ? ` • ${respondent.name}` : ''}`,
        html: emailHtml,
        attachments: [
          {
            filename: `resultado-perfil-${fileName}.pdf`,
            content: pdfBase64,
            contentType: 'application/pdf',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.message || 'Falha ao enviar e-mail.');
    }

    return json(res, 200, { ok: true });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao enviar e-mail.', err?.message);
  }
}
