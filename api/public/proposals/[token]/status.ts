import { json, methodNotAllowed, notFound, badRequest, serverError } from '../../../_utils/http';
import { supabaseAdmin } from '../../../_utils/supabase';
import { ASAAS_API_KEY, ASAAS_ENV, ASAAS_SPLIT_WALLETS_JSON } from '../../../_utils/env';
import { createPayment, ensureCustomer } from '../../../../src/lib/integrations/asaas';

const normalizeDoc = (value?: string | null) => (value || '').replace(/\D/g, '');

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

    const { data: zapsign } = await supabaseAdmin
      .from('od_zapsign_documents')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let payment = await supabaseAdmin
      .from('od_asaas_payments')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (proposal.requires_signature && zapsign?.status === 'signed' && !payment.data) {
      const ensured = await ensurePaymentForProposal(proposal);
      payment = { data: ensured.payment, error: null } as any;
    }

    return json(res, 200, {
      proposal: {
        id: proposal.id,
        status: proposal.status,
        requires_signature: proposal.requires_signature,
        amount_cents: proposal.amount_cents,
        payment_methods: proposal.payment_methods,
      },
      signature: zapsign
        ? {
            status: zapsign.status,
            signUrl: zapsign.raw?.signers?.[0]?.url || null,
          }
        : null,
      payment: payment?.data
        ? {
            status: payment.data.status,
            invoice_url: payment.data.invoice_url,
            paid_at: payment.data.paid_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao buscar status.', err?.message);
  }
}
