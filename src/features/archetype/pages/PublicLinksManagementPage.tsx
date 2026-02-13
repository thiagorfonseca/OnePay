import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { supabase } from '../../../../lib/supabase';
import { createPublicLink, listPublicLinks, togglePublicLink } from '../archetypeService';
import type { AudienceType, PublicLinkRow } from '../types';

const generateToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 12);
};

const PublicLinksManagementPage: React.FC = () => {
  const { effectiveClinicId: clinicId, user } = useAuth();
  const [links, setLinks] = useState<PublicLinkRow[]>([]);
  const [respondedTokens, setRespondedTokens] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState(generateToken());
  const [audienceType, setAudienceType] = useState<AudienceType>('EXTERNAL');
  const [collaborators, setCollaborators] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [error, setError] = useState<string | null>(null);

  const collaboratorMap = useMemo(() => {
    return Object.fromEntries(collaborators.map((collab) => [collab.id, collab.name]));
  }, [collaborators]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin.replace(/\/$/, '');
  }, []);

  const loadLinks = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, respondents] = await Promise.all([
        listPublicLinks(clinicId),
        supabase
          .from('archetype_respondents')
          .select('public_token')
          .eq('clinic_id', clinicId),
      ]);
      setLinks(data);
      const tokens = new Set(
        (respondents.data || [])
          .map((row: any) => row.public_token)
          .filter((tokenValue: string) => !!tokenValue)
      );
      setRespondedTokens(tokens);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os links.');
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  useEffect(() => {
    if (!clinicId) return;
    const loadCollaborators = async () => {
      const { data } = await supabase
        .from('clinic_users')
        .select('id, name, email')
        .eq('clinic_id', clinicId)
        .order('name', { ascending: true });
      setCollaborators((data || []).map((row: any) => ({
        id: row.id,
        name: row.name || row.email || 'Colaborador',
        email: row.email || '',
      })));
    };
    loadCollaborators();
  }, [clinicId]);

  const handleCreate = async () => {
    if (!clinicId) return;
    if (!token.trim()) {
      setError('Informe um token válido.');
      return;
    }
    if (audienceType === 'INTERNAL' && !selectedCollaborator) {
      setError('Selecione um colaborador para o link interno.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createPublicLink({
        clinic_id: clinicId,
        token: token.trim(),
        audience_type: audienceType,
        created_by_user_id: user?.id || null,
        collaborator_id: audienceType === 'INTERNAL' ? selectedCollaborator : null,
      });
      setLinks((prev) => [created, ...prev]);
      setToken(generateToken());
      setSelectedCollaborator('');
    } catch (err) {
      console.error(err);
      setError('Não foi possível criar o link. Verifique se o token já existe.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (tokenValue: string) => {
    const url = `${baseUrl}/public/perfil/${tokenValue}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const handleToggle = async (link: PublicLinkRow) => {
    try {
      const updated = await togglePublicLink(link.id, !link.is_active);
      setLinks((prev) => prev.map((item) => (item.id === link.id ? updated : item)));
    } catch (err) {
      console.error(err);
      setError('Não foi possível atualizar o link.');
    }
  };

  if (!clinicId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-500">Selecione uma clínica para gerenciar os links.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Token público</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Audiência</label>
          <select
            value={audienceType}
            onChange={(e) => {
              const next = e.target.value as AudienceType;
              setAudienceType(next);
              if (next !== 'INTERNAL') setSelectedCollaborator('');
            }}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            <option value="INTERNAL">Interna</option>
            <option value="EXTERNAL">Externa</option>
          </select>
        </div>
        {audienceType === 'INTERNAL' && (
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Colaborador</label>
            <select
              value={selectedCollaborator}
              onChange={(e) => setSelectedCollaborator(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Selecione...</option>
              {collaborators.map((collab) => (
                <option key={collab.id} value={collab.id}>
                  {collab.name}{collab.email ? ` • ${collab.email}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'Criando...' : 'Criar link'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="table-scroll">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Token</th>
                <th className="text-left px-4 py-3">Audiência</th>
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Link</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link) => (
                <tr key={link.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{link.token}</td>
                  <td className="px-4 py-3">{link.audience_type === 'INTERNAL' ? 'Interna' : 'Externa'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {link.audience_type === 'INTERNAL'
                      ? (link.collaborator_id ? (collaboratorMap[link.collaborator_id] || 'Colaborador') : '—')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      respondedTokens.has(link.token)
                        ? 'bg-amber-100 text-amber-700'
                        : link.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {respondedTokens.has(link.token) ? 'Respondido' : (link.is_active ? 'Ativo' : 'Inativo')}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs ${respondedTokens.has(link.token) ? 'text-gray-300 line-through' : 'text-gray-500'}`}>
                    {baseUrl ? `${baseUrl}/public/perfil/${link.token}` : 'Link indisponível'}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    {respondedTokens.has(link.token) ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">Respondido</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(link.token)}
                          className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center justify-center"
                          aria-label="Copiar link"
                          title="Copiar link"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(link)}
                          className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center justify-center"
                          aria-label={link.is_active ? 'Desativar link' : 'Ativar link'}
                          title={link.is_active ? 'Desativar link' : 'Ativar link'}
                        >
                          {link.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && links.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                    Nenhum link criado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                    Carregando links...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PublicLinksManagementPage;
