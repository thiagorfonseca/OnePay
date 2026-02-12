import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  email_principal: string | null;
  telefone: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  em_negociacao: 'Em negociação',
  ativo: 'Ativo',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
};

const AdminODClients: React.FC = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    legal_name: '',
    trade_name: '',
    cnpj: '',
    email_principal: '',
    telefone: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('od_clients')
      .select('id, legal_name, trade_name, cnpj, email_principal, telefone, status, created_at')
      .order('created_at', { ascending: false });
    setClients((data || []) as ClientRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.legal_name, client.trade_name, client.cnpj, client.email_principal]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    );
  }, [clients, search]);

  const handleCreate = async () => {
    if (!form.legal_name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('od_clients')
      .insert({
        legal_name: form.legal_name.trim(),
        trade_name: form.trade_name || null,
        cnpj: form.cnpj || null,
        email_principal: form.email_principal || null,
        telefone: form.telefone || null,
        status: 'lead',
      });
    setSaving(false);
    if (!error) {
      setForm({ legal_name: '', trade_name: '', cnpj: '', email_principal: '', telefone: '' });
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <p className="text-gray-500">Centralize o cadastro de clientes OneDoctor.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Novo cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={form.legal_name}
            onChange={(e) => setForm((prev) => ({ ...prev, legal_name: e.target.value }))}
            placeholder="Razão social"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            value={form.trade_name}
            onChange={(e) => setForm((prev) => ({ ...prev, trade_name: e.target.value }))}
            placeholder="Nome fantasia"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            value={form.cnpj}
            onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
            placeholder="CNPJ"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            value={form.email_principal}
            onChange={(e) => setForm((prev) => ({ ...prev, email_principal: e.target.value }))}
            placeholder="Email principal"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            value={form.telefone}
            onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
            placeholder="Telefone"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-64"
          />
          <div className="text-sm text-gray-500">{filtered.length} clientes</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-500">
              <tr className="text-left">
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">CNPJ</th>
                <th className="py-2 px-2">Contato</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">Carregando...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((client) => (
                  <tr key={client.id} className="border-t border-gray-100">
                    <td className="py-2 px-2 font-medium text-gray-700">
                      {client.trade_name || client.legal_name}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{client.cnpj || '-'}</td>
                    <td className="py-2 px-2 text-gray-500">{client.email_principal || '-'}</td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                        {STATUS_LABELS[client.status] || client.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Link
                        to={`/admin/clientes/${client.id}`}
                        className="text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminODClients;
