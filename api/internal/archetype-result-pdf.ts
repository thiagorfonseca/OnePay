import { buildPdfFromHtml } from '../_utils/pdf';
import { buildArchetypeResultHtml } from '../_utils/archetypeReport';
import { requireClinicAccess } from '../_utils/auth';
import { badRequest, methodNotAllowed, notFound, serverError, unauthorized } from '../_utils/http';
import { supabaseAdmin } from '../_utils/supabase';

const getQueryValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || '';

const toFileSafeName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const respondentId = getQueryValue(req.query?.respondentId || req.query?.id);
    if (!respondentId) return badRequest(res, 'Informe respondentId.');

    const { data: respondent, error } = await supabaseAdmin
      .from('archetype_respondents')
      .select('id, name, email, phone, scores, top_profile, top_profiles, created_at, clinic_id')
      .eq('id', respondentId)
      .maybeSingle();

    if (error) throw error;
    if (!respondent) return notFound(res, 'Respondente não encontrado.');

    const access = await requireClinicAccess(req, respondent.clinic_id);
    if (!access) return unauthorized(res, 'Acesso não autorizado.');

    const html = buildArchetypeResultHtml(respondent);
    const pdfBase64 = await buildPdfFromHtml(html);
    const buffer = Buffer.from(pdfBase64, 'base64');
    const fileName = toFileSafeName(respondent.name || 'respondente') || 'respondente';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resultado-perfil-${fileName}.pdf"`);
    res.statusCode = 200;
    res.end(buffer);
    return;
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao gerar PDF.', err?.message);
  }
}
