import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

interface ProposalRow {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  created_at: string;
  public_token: string;
  od_clients?: { legal_name?: string | null; trade_name?: string | null } | null;
}

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

const AdminODProposals: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadProposals = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('od_proposals')
      .select('id, title, status, amount_cents, created_at, public_token, od_clients (legal_name, trade_name)')
      .order('created_at', { ascending: false });
    setProposals((data || []) as ProposalRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadProposals();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proposals.filter((proposal) => {
      if (statusFilter && proposal.status !== statusFilter) return false;
      if (!term) return true;
      const clientName = proposal.od_clients?.trade_name || proposal.od_clients?.legal_name || '';
      return (
        proposal.title?.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term)
      );
    });
  }, [proposals, search, statusFilter]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Propostas</h1>
          <p className="text-gray-500">Gerencie propostas comerciais do OneDoctor.</p>
        </div>
        <Link
          to="/admin/propostas/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
        >
          <Plus size={18} />
          Nova proposta
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por proposta ou cliente"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Todos status</option>
              {Object.keys(STATUS_LABELS).map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">{filtered.length} propostas</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-500">
              <tr className="text-left">
                <th className="py-2 px-2">Proposta</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Valor</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Criada</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-400">Carregando...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((proposal) => {
                  const clientName = proposal.od_clients?.trade_name || proposal.od_clients?.legal_name || '—';
                  const publicLink = proposal.public_token ? `${baseUrl}/cadastro/${proposal.public_token}` : '';
                  return (
                    <tr key={proposal.id} className="border-t border-gray-100">
                      <td className="py-2 px-2 font-medium text-gray-700">{proposal.title}</td>
                      <td className="py-2 px-2 text-gray-500">{clientName}</td>
                      <td className="py-2 px-2 text-gray-500">{formatCurrency((proposal.amount_cents || 0) / 100)}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                          {STATUS_LABELS[proposal.status] || proposal.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500">
                        {proposal.created_at ? new Date(proposal.created_at).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-2 px-2 text-right space-x-3">
                        {publicLink ? (
                          <a
                            href={publicLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600"
                          >
                            <LinkIcon size={14} />
                            Link
                          </a>
                        ) : null}
                        <Link
                          to={`/admin/propostas/${proposal.id}`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">Nenhuma proposta encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminODProposals;
