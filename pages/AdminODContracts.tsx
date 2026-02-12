import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContractTemplate {
  id: string;
  name: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminODContracts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [search, setSearch] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('od_contract_templates')
      .select('id, name, version, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
    setTemplates((data || []) as ContractTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((tpl) => tpl.name.toLowerCase().includes(term));
  }, [templates, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contratos</h1>
          <p className="text-gray-500">Modelos de contrato usados nas propostas.</p>
        </div>
        <Link
          to="/admin/contratos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
        >
          <Plus size={18} />
          Adicionar contrato
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText size={16} />
            {templates.length} modelo(s)
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-500">
              <tr className="text-left">
                <th className="py-2 px-2">Nome</th>
                <th className="py-2 px-2">Versão</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Atualizado</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">Carregando...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((tpl) => (
                  <tr key={tpl.id} className="border-t border-gray-100">
                    <td className="py-2 px-2 font-medium text-gray-700">{tpl.name}</td>
                    <td className="py-2 px-2 text-gray-500">v{tpl.version}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${tpl.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tpl.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-500">
                      {tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Link
                        to={`/admin/contratos/${tpl.id}`}
                        className="text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">Nenhum contrato encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminODContracts;
