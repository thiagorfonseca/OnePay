import { z } from 'zod';
import { readJson, json, methodNotAllowed, badRequest, notFound, serverError } from '../../../_utils/http';
import { supabaseAdmin } from '../../../_utils/supabase';
import { ASAAS_API_KEY, ASAAS_ENV, ASAAS_SPLIT_WALLETS_JSON, ZAPSIGN_API_TOKEN, APP_BASE_URL } from '../../../_utils/env';
import { applyContractTags } from '../../../_utils/contract';
import { buildPdfFromHtml } from '../../../_utils/pdf';
import { createDocumentFromBase64 } from '../../../../src/lib/integrations/zapsign';
import { createPayment, ensureCustomer } from '../../../../src/lib/integrations/asaas';

const payloadSchema = z.object({
  company: z.object({
    legal_name: z.string().min(2),
    trade_name: z.string().optional().nullable(),
    cnpj: z.string().min(8),
    state_registration: z.string().optional().nullable(),
    email_principal: z.string().email(),
    email_financeiro: z.string().email().optional().nullable(),
    telefone: z.string().min(8),
    whatsapp: z.string().optional().nullable(),
    address: z.object({
      logradouro: z.string().min(2),
      numero: z.string().min(1),
      complemento: z.string().optional().nullable(),
      bairro: z.string().min(2),
      cidade: z.string().min(2),
      uf: z.string().min(2).max(2),
      cep: z.string().min(8),
    }),
  }),
  responsible: z.object({
    name: z.string().min(2),
    cpf: z.string().min(8),
    email: z.string().email(),
    telefone: z.string().min(8),
  }),
});

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

const getContractHtml = async (contractTemplateId: string | null, fallback: string) => {
  if (!contractTemplateId) return fallback;
  const { data } = await supabaseAdmin
    .from('od_contract_templates')
    .select('html_content')
    .eq('id', contractTemplateId)
    .maybeSingle();
  return data?.html_content || fallback;
};

const ensurePaymentForProposal = async (proposal: any, payload: any) => {
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

const ensureZapsignForProposal = async (proposal: any, payload: any) => {
  const { data: existing } = await supabaseAdmin
    .from('od_zapsign_documents')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.raw?.signers?.[0]?.url) {
    return { signUrl: existing.raw.signers[0].url, doc: existing };
  }
  if (!ZAPSIGN_API_TOKEN) throw new Error('ZAPSIGN_API_TOKEN ausente.');

  const fallbackHtml = `<h2>Contrato OneDoctor</h2><p>Cliente: {{razao_social}}</p><p>Produto: {{produto_nome}}</p>`;
  const html = await getContractHtml(proposal.contract_template_id || null, fallbackHtml);

  const filledHtml = applyContractTags(html, {
    responsavel_nome: payload.responsible.name,
    responsavel_cpf: payload.responsible.cpf,
    responsavel_email: payload.responsible.email,
    responsavel_telefone: payload.responsible.telefone,
    razao_social: payload.company.legal_name,
    nome_fantasia: payload.company.trade_name,
    cnpj: payload.company.cnpj,
    endereco_logradouro: payload.company.address.logradouro,
    endereco_numero: payload.company.address.numero,
    endereco_bairro: payload.company.address.bairro,
    endereco_cidade: payload.company.address.cidade,
    endereco_uf: payload.company.address.uf,
    endereco_cep: payload.company.address.cep,
    produto_nome: proposal.title,
    produto_valor: `R$ ${((proposal.amount_cents || 0) / 100).toFixed(2).replace('.', ',')}`,
    forma_pagamento: pickBillingType(proposal.payment_methods),
    parcelas: proposal.installments ? String(proposal.installments) : '',
  });

  const base64Pdf = await buildPdfFromHtml(filledHtml);

  const document = await createDocumentFromBase64(ZAPSIGN_API_TOKEN, {
    name: proposal.title || 'Contrato OneDoctor',
    base64_pdf: base64Pdf,
    signers: [
      {
        name: payload.responsible.name,
        email: payload.responsible.email,
        cpf: normalizeDoc(payload.responsible.cpf),
        anchor: '<<signer1>>',
      },
    ],
    lang: 'pt-br',
    external_id: proposal.id,
    redirectUrl: APP_BASE_URL ? `${APP_BASE_URL}/assinatura/retorno?token=${proposal.public_token}` : undefined,
  });

  const signUrl = document?.signers?.[0]?.url || document?.url || null;

  const { data: stored } = await supabaseAdmin
    .from('od_zapsign_documents')
    .insert({
      proposal_id: proposal.id,
      zapsign_doc_id: document.id || document.doc_id || document.docId,
      status: 'sent',
      signer_email: payload.responsible.email,
      signer_name: payload.responsible.name,
      raw: document,
    })
    .select('*')
    .single();

  await supabaseAdmin
    .from('od_proposals')
    .update({ status: 'signature_sent' })
    .eq('id', proposal.id);

  return { signUrl, doc: stored };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJson(req);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(res, 'Payload inválido.', parsed.error.flatten());
    }

    const token = req.query?.token as string;
    if (!token) return badRequest(res, 'Token ausente.');

    const { data: proposal } = await supabaseAdmin
      .from('od_proposals')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (!proposal) return notFound(res, 'Proposta não encontrada.');

    if (proposal.expires_at && new Date(proposal.expires_at).getTime() < Date.now()) {
      return badRequest(res, 'Proposta expirada.');
    }

    const payload = parsed.data;

    const clientPayload = {
      legal_name: payload.company.legal_name,
      trade_name: payload.company.trade_name || null,
      cnpj: normalizeDoc(payload.company.cnpj),
      state_registration: payload.company.state_registration || null,
      email_financeiro: payload.company.email_financeiro || null,
      email_principal: payload.company.email_principal || null,
      telefone: payload.company.telefone || null,
      whatsapp: payload.company.whatsapp || null,
      address_logradouro: payload.company.address.logradouro,
      address_numero: payload.company.address.numero,
      address_complemento: payload.company.address.complemento || null,
      address_bairro: payload.company.address.bairro,
      address_cidade: payload.company.address.cidade,
      address_uf: payload.company.address.uf,
      address_cep: payload.company.address.cep,
      contact_person_name: payload.responsible.name,
      contact_person_cpf: payload.responsible.cpf,
      status: 'em_negociacao',
    };

    let clientId = proposal.client_id as string | null;

    if (clientId) {
      await supabaseAdmin.from('od_clients').update(clientPayload).eq('id', clientId);
    } else {
      const { data: client } = await supabaseAdmin
        .from('od_clients')
        .insert(clientPayload)
        .select('id')
        .single();
      clientId = client?.id || null;
      if (clientId) {
        await supabaseAdmin.from('od_proposals').update({ client_id: clientId }).eq('id', proposal.id);
      }
    }

    await supabaseAdmin
      .from('od_proposal_form_submissions')
      .insert({
        proposal_id: proposal.id,
        payload,
      });

    await supabaseAdmin
      .from('od_proposals')
      .update({ status: 'form_filled' })
      .eq('id', proposal.id);

    if (proposal.requires_signature) {
      const { signUrl } = await ensureZapsignForProposal(proposal, payload);
      if (!signUrl) return serverError(res, 'Falha ao gerar assinatura.');
      return json(res, 200, { next: 'signature', signUrl, proposalId: proposal.id });
    }

    const { invoiceUrl } = await ensurePaymentForProposal(proposal, payload);
    if (!invoiceUrl) return serverError(res, 'Falha ao gerar cobrança.');
    return json(res, 200, { next: 'payment', invoiceUrl, proposalId: proposal.id });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao enviar proposta.', err?.message);
  }
}
