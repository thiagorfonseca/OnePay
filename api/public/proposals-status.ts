import { json, methodNotAllowed, notFound, badRequest, serverError } from '../_utils/http.js';
import { supabaseAdmin } from '../_utils/supabase.js';
import { ASAAS_API_KEY, ASAAS_ENV, ASAAS_SPLIT_WALLETS_JSON, ZAPSIGN_API_TOKEN } from '../_utils/env.js';
import { createPayment, ensureCustomer } from '../../src/lib/integrations/asaas.js';
import { getDocument } from '../../src/lib/integrations/zapsign.js';

const normalizeDoc = (value?: string | null) => (value || '').replace(/\D/g, '');
const isSignedStatus = (value?: string | null) => {
  if (!value) return false;
  const raw = value.toLowerCase();
  return raw.includes('signed') || raw.includes('assinado');
};

const pickBillingType = (methods: any) => {
  if (methods?.pix) return 'PIX';
  if (methods?.boleto) return 'BOLETO';
  if (methods?.creditCard) return 'CREDIT_CARD';
  return 'PIX';
};

const parseSplit = () => {
  if (!ASAAS_SPLIT_WALLETS_JSON) return [] as any[];
  try {
    const parsed = JSON.parse(ASAAS_SPLIT_WALLETS_JSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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

const ensurePaymentForProposal = async (proposal: any) => {
  const { data: existing } = await supabaseAdmin
    .from('od_asaas_payments')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.invoice_url) {
    return { invoiceUrl: existing.invoice_url, payment: existing };
  }

  const payload = await loadLatestPayload(proposal.id);
  if (!payload) return { invoiceUrl: null, payment: null };

  if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY ausente.');

  const customer = await ensureCustomer(
    { apiKey: ASAAS_API_KEY, env: ASAAS_ENV },
    {
      name: payload.company.trade_name || payload.company.legal_name,
      cpfCnpj: normalizeDoc(payload.company.cnpj),
      email: payload.company.email_principal,
      mobilePhone: payload.company.whatsapp || payload.company.telefone,
      address: payload.company.address.logradouro,
      addressNumber: payload.company.address.numero,
      complement: payload.company.address.complemento || undefined,
      province: payload.company.address.bairro,
      city: payload.company.address.cidade,
      state: payload.company.address.uf,
      postalCode: normalizeDoc(payload.company.address.cep),
    }
  );

  const billingType = pickBillingType(proposal.payment_methods);

  const payment = await createPayment(
    { apiKey: ASAAS_API_KEY, env: ASAAS_ENV },
    {
      customerId: customer.id,
      billingType: billingType as any,
      value: (proposal.amount_cents || 0) / 100,
      installmentCount: billingType === 'CREDIT_CARD' ? proposal.installments || 1 : undefined,
      split: parseSplit(),
      description: proposal.title || 'Proposta OneDoctor',
      externalReference: proposal.id,
    }
  );

  const invoiceUrl = payment?.invoiceUrl || payment?.invoice_url || payment?.bankSlipUrl || null;

  const { data: stored } = await supabaseAdmin
    .from('od_asaas_payments')
    .insert({
      proposal_id: proposal.id,
      asaas_customer_id: customer.id,
      asaas_payment_id: payment.id,
      invoice_url: invoiceUrl,
      status: (payment.status || 'created').toString().toLowerCase(),
      raw: payment,
    })
    .select('*')
    .single();

  await supabaseAdmin
    .from('od_proposals')
    .update({ status: 'payment_created' })
    .eq('id', proposal.id);

  return { invoiceUrl, payment: stored };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const token = req.query?.token as string;
  if (!token) return badRequest(res, 'Token ausente.');

  try {
    const { data: proposal } = await supabaseAdmin
      .from('od_proposals')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (!proposal) return notFound(res, 'Proposta não encontrada.');

    let payment: any = null;
    let invoiceUrl: string | null = null;
    let signatureUrl: string | null = null;

    if (proposal.status === 'signed' || proposal.status === 'payment_created' || proposal.status === 'paid') {
      const ensured = await ensurePaymentForProposal(proposal);
      payment = ensured.payment;
      invoiceUrl = ensured.invoiceUrl;
    } else {
      const { data: existing } = await supabaseAdmin
        .from('od_asaas_payments')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        payment = existing;
        invoiceUrl = existing.invoice_url || null;
      }
    }

    if (proposal.requires_signature && !['signed', 'paid', 'payment_created'].includes(proposal.status)) {
      const { data: doc } = await supabaseAdmin
        .from('od_zapsign_documents')
        .select('id, zapsign_doc_id, raw')
        .eq('proposal_id', proposal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const storedSigner = doc?.raw?.signers?.[0];
      const storedToken = storedSigner?.signer_token || storedSigner?.token;
      signatureUrl =
        storedSigner?.sign_url ||
        storedSigner?.url ||
        (storedToken ? `https://app.zapsign.com.br/verificar/${storedToken}` : null) ||
        doc?.raw?.signer_url ||
        doc?.raw?.url ||
        null;

      const docToken =
        doc?.zapsign_doc_id ||
        doc?.raw?.token ||
        doc?.raw?.doc_id ||
        doc?.raw?.id ||
        doc?.raw?.docId ||
        null;
      if (docToken && ZAPSIGN_API_TOKEN) {
        try {
          if (!doc?.zapsign_doc_id && docToken) {
            await supabaseAdmin.from('od_zapsign_documents').update({ zapsign_doc_id: docToken }).eq('id', doc.id);
          }
          const fresh = await getDocument(ZAPSIGN_API_TOKEN, docToken);
          const freshSigner = fresh?.signers?.[0];
          const freshToken = freshSigner?.signer_token || freshSigner?.token;
          signatureUrl =
            freshSigner?.sign_url ||
            freshSigner?.url ||
            (freshToken ? `https://app.zapsign.com.br/verificar/${freshToken}` : null) ||
            fresh?.signer_url ||
            fresh?.url ||
            signatureUrl;
          const allSigned =
            isSignedStatus(fresh?.status) ||
            (Array.isArray(fresh?.signers) && fresh.signers.length > 0
              ? fresh.signers.every((signer: any) => isSignedStatus(signer?.status))
              : false);
          if (signatureUrl) {
            await supabaseAdmin
              .from('od_zapsign_documents')
              .update({ raw: fresh })
              .eq('id', doc.id);
          }
          if (allSigned) {
            await supabaseAdmin
              .from('od_zapsign_documents')
              .update({ status: 'signed', signed_at: new Date().toISOString(), raw: fresh })
              .eq('id', doc.id);
            await supabaseAdmin.from('od_proposals').update({ status: 'signed' }).eq('id', proposal.id);
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    return json(res, 200, {
      status: proposal.status,
      proposal,
      payment,
      invoiceUrl,
      signatureUrl,
    });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao consultar status.', err?.message || err);
  }
}
