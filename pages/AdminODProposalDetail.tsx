import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Mail, MessageCircle, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { ToastStack } from '../components/Toast';

const STATUS_FLOW = [
  'draft',
  'sent',
  'form_filled',
  'signature_sent',
  'signed',
  'payment_created',
  'paid',
  'provisioned',
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  form_filled: 'Formulário preenchido',
  signature_sent: 'Assinatura enviada',
  signed: 'Assinada',
  payment_created: 'Pagamento gerado',
  paid: 'Pago',
  provisioned: 'Provisionado',
  expired: 'Expirada',
  canceled: 'Cancelada',
};

const AdminODProposalDetail: React.FC = () => {
  const { id } = useParams();
  const { toasts, push, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [zapsign, setZapsign] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [emailTo, setEmailTo] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: proposalData } = await (supabase as any)
      .from('od_proposals')
      .select('*, od_clients (*)')
      .eq('id', id)
      .maybeSingle();

    const { data: subData } = await (supabase as any)
      .from('od_proposal_form_submissions')
      .select('*')
      .eq('proposal_id', id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: zapData } = await (supabase as any)
      .from('od_zapsign_documents')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: payData } = await (supabase as any)
      .from('od_asaas_payments')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setProposal(proposalData || null);
    setSubmission(subData || null);
    setZapsign(zapData || null);
    setPayment(payData || null);
    setEmailTo(
      subData?.payload?.responsible?.email ||
        subData?.payload?.company?.email_principal ||
        proposalData?.od_clients?.email_principal ||
        ''
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const publicLink = useMemo(() => {
    if (!proposal?.public_token) return '';
    return `${window.location.origin}/cadastro/${proposal.public_token}`;
  }, [proposal?.public_token]);

  const currentStatusIndex = STATUS_FLOW.indexOf(proposal?.status || 'draft');

  const handleCopy = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      push({ title: 'Link copiado', variant: 'success' });
    } catch {
      push({ title: 'Falha ao copiar', variant: 'error' });
    }
  };

  const handleEmail = async () => {
    if (!emailTo) {
      push({ title: 'Informe o e-mail do cliente.', variant: 'error' });
      return;
    }
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      push({ title: 'Sessão inválida.', variant: 'error' });
      return;
    }

    const response = await fetch('/api/internal/send-proposal-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ proposalId: proposal.id, to: emailTo }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      push({ title: 'Erro ao enviar e-mail', description: body?.error || '', variant: 'error' });
      return;
    }

    push({ title: 'E-mail enviado com sucesso.', variant: 'success' });
  };

  const handleWhatsApp = async () => {
    if (!publicLink) return;
    const text = `Olá! Segue o link para completar o cadastro: ${publicLink}`;
    try {
      await navigator.clipboard.writeText(text);
      push({ title: 'Mensagem pronta copiada.', variant: 'success' });
    } catch {
      push({ title: 'Não foi possível copiar.', variant: 'error' });
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Carregando...</div>;
  }

  if (!proposal) {
    return <div className="text-sm text-gray-400">Proposta não encontrada.</div>;
  }

  const signedUrl = zapsign?.raw?.signed_file_url || zapsign?.raw?.signed_document_url || null;
  const invoiceUrl = payment?.invoice_url || null;

  return (
    <div className="space-y-4">
      <ToastStack items={toasts} onDismiss={dismiss} />

      <div>
        <h1 className="text-2xl font-bold text-gray-800">{proposal.title}</h1>
        <p className="text-gray-500">Detalhes da proposta e acompanhamento do fluxo.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Timeline</h2>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
              >
                <RefreshCw size={14} />
                Atualizar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {STATUS_FLOW.map((status, idx) => (
                <div
                  key={status}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    idx <= currentStatusIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400'
                  }`}
                >
                  {STATUS_LABELS[status] || status}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Dados do cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div>
                <span className="text-gray-500">Razão social</span>
                <div className="font-medium text-gray-800">{proposal.od_clients?.legal_name || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Nome fantasia</span>
                <div className="font-medium text-gray-800">{proposal.od_clients?.trade_name || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">CNPJ</span>
                <div className="font-medium text-gray-800">{proposal.od_clients?.cnpj || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Contato</span>
                <div className="font-medium text-gray-800">{proposal.od_clients?.email_principal || '—'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Ações</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Copy size={16} />
                Copiar link
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <MessageCircle size={16} />
                Mensagem WhatsApp
              </button>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LinkIcon size={16} />
                  Ver documento assinado
                </a>
              ) : null}
              {invoiceUrl ? (
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LinkIcon size={16} />
                  Ver pagamento
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Email do cliente"
                className="px-3 py-2 border border-gray-200 rounded-lg w-full sm:w-72"
              />
              <button
                type="button"
                onClick={handleEmail}
                className="inline-flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
              >
                <Mail size={16} />
                Enviar por e-mail
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Resumo</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>Valor</span>
                <span className="font-medium text-gray-800">{formatCurrency((proposal.amount_cents || 0) / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-medium text-gray-800">{STATUS_LABELS[proposal.status] || proposal.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Contrato</span>
                <span className="font-medium text-gray-800">{proposal.requires_signature ? 'Assinatura' : 'Dispensado'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Link público</h2>
            <div className="text-xs text-gray-500 break-all">{publicLink || '—'}</div>
          </div>

          {submission ? (
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Formulário</h2>
              <div className="text-xs text-gray-500">Enviado em {new Date(submission.submitted_at).toLocaleString('pt-BR')}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminODProposalDetail;
