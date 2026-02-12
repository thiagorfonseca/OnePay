import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

type TabKey = 'geral' | 'propostas' | 'entitlements' | 'pagamentos';

const AdminODClientDetail: React.FC = () => {
  const { id } = useParams();
  const [tab, setTab] = useState<TabKey>('geral');
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: clientData } = await (supabase as any)
      .from('od_clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    setClient(clientData || null);

    const { data: proposalData } = await (supabase as any)
      .from('od_proposals')
      .select('id, title, status, amount_cents, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false });
    setProposals(proposalData || []);

    if (clientData?.cnpj) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id')
        .eq('documento', clientData.cnpj)
        .maybeSingle();
      if (clinic?.id) {
        const { data: entData } = await (supabase as any)
          .from('od_entitlements')
          .select('id, status, package_id, products, created_at')
          .eq('tenant_id', clinic.id)
          .order('created_at', { ascending: false });
        setEntitlements(entData || []);
      } else {
        setEntitlements([]);
      }
    }

    if (proposalData?.length) {
      const proposalIds = proposalData.map((p: any) => p.id);
      const { data: payData } = await (supabase as any)
        .from('od_asaas_payments')
        .select('proposal_id, status, invoice_url, created_at, paid_at')
        .in('proposal_id', proposalIds)
        .order('created_at', { ascending: false });
      setPayments(payData || []);
    } else {
      setPayments([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    await (supabase as any)
      .from('od_clients')
      .update({
        legal_name: client.legal_name,
        trade_name: client.trade_name,
        cnpj: client.cnpj,
        state_registration: client.state_registration,
        email_principal: client.email_principal,
        email_financeiro: client.email_financeiro,
        telefone: client.telefone,
        whatsapp: client.whatsapp,
        address_logradouro: client.address_logradouro,
        address_numero: client.address_numero,
        address_complemento: client.address_complemento,
        address_bairro: client.address_bairro,
        address_cidade: client.address_cidade,
        address_uf: client.address_uf,
        address_cep: client.address_cep,
        contact_person_name: client.contact_person_name,
        contact_person_cpf: client.contact_person_cpf,
        status: client.status,
      })
      .eq('id', client.id);
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-gray-400">Carregando...</div>;
  if (!client) return <div className="text-sm text-gray-400">Cliente não encontrado.</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{client.trade_name || client.legal_name}</h1>
        <p className="text-gray-500">Detalhes do cliente.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('geral')}
          className={`px-3 py-2 text-sm rounded-lg border ${tab === 'geral' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setTab('propostas')}
          className={`px-3 py-2 text-sm rounded-lg border ${tab === 'propostas' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          Propostas
        </button>
        <button
          type="button"
          onClick={() => setTab('entitlements')}
          className={`px-3 py-2 text-sm rounded-lg border ${tab === 'entitlements' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          Produtos/Pacotes
        </button>
        <button
          type="button"
          onClick={() => setTab('pagamentos')}
          className={`px-3 py-2 text-sm rounded-lg border ${tab === 'pagamentos' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          Pagamentos
        </button>
      </div>

      {tab === 'geral' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2 text-sm text-gray-600">
              <span>Razão social</span>
              <input
                value={client.legal_name || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, legal_name: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Nome fantasia</span>
              <input
                value={client.trade_name || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, trade_name: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>CNPJ</span>
              <input
                value={client.cnpj || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, cnpj: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Inscrição estadual</span>
              <input
                value={client.state_registration || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, state_registration: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Email principal</span>
              <input
                value={client.email_principal || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, email_principal: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Email financeiro</span>
              <input
                value={client.email_financeiro || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, email_financeiro: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Telefone</span>
              <input
                value={client.telefone || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, telefone: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>WhatsApp</span>
              <input
                value={client.whatsapp || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, whatsapp: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Responsável</span>
              <input
                value={client.contact_person_name || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, contact_person_name: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>CPF responsável</span>
              <input
                value={client.contact_person_cpf || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, contact_person_cpf: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Status</span>
              <select
                value={client.status || 'lead'}
                onChange={(e) => setClient((prev: any) => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="lead">Lead</option>
                <option value="em_negociacao">Em negociação</option>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
              <span>Logradouro</span>
              <input
                value={client.address_logradouro || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_logradouro: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Número</span>
              <input
                value={client.address_numero || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_numero: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Bairro</span>
              <input
                value={client.address_bairro || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_bairro: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>Cidade</span>
              <input
                value={client.address_cidade || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_cidade: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>UF</span>
              <input
                value={client.address_uf || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_uf: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              <span>CEP</span>
              <input
                value={client.address_cep || ''}
                onChange={(e) => setClient((prev: any) => ({ ...prev, address_cep: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {tab === 'propostas' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Propostas</h2>
          {proposals.length ? (
            <div className="space-y-2">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{proposal.title}</div>
                    <div className="text-xs text-gray-500">{proposal.status}</div>
                  </div>
                  <div className="text-sm text-gray-600">{formatCurrency((proposal.amount_cents || 0) / 100)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nenhuma proposta vinculada.</div>
          )}
        </div>
      )}

      {tab === 'entitlements' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Produtos/Pacotes liberados</h2>
          {entitlements.length ? (
            <div className="space-y-2">
              {entitlements.map((ent) => (
                <div key={ent.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-sm text-gray-700">Pacote: {ent.package_id || '—'}</div>
                  <div className="text-xs text-gray-500">Status: {ent.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nenhum entitlement registrado.</div>
          )}
        </div>
      )}

      {tab === 'pagamentos' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Pagamentos</h2>
          {payments.length ? (
            <div className="space-y-2">
              {payments.map((pay) => (
                <div key={pay.asaas_payment_id || pay.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-sm text-gray-700">Status: {pay.status}</div>
                  <div className="text-xs text-gray-500">Criado em {new Date(pay.created_at).toLocaleDateString('pt-BR')}</div>
                  {pay.invoice_url ? (
                    <a href={pay.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600">
                      Ver cobrança
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nenhum pagamento registrado.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminODClientDetail;
