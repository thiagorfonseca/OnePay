import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from '../components/RichTextEditor';
import { useToast } from '../hooks/useToast';
import { ToastStack } from '../components/Toast';

const TAGS = [
  '{{nome_completo_responsavel}}',
  '{{cpf_responsavel}}',
  '{{email}}',
  '{{telefone}}',
  '{{razao_social}}',
  '{{nome_fantasia}}',
  '{{cnpj}}',
  '{{endereco_logradouro}}',
  '{{endereco_numero}}',
  '{{endereco_bairro}}',
  '{{endereco_cidade}}',
  '{{endereco_uf}}',
  '{{endereco_cep}}',
  '{{produto_nome}}',
  '{{produto_valor}}',
  '{{forma_pagamento}}',
  '{{parcelas}}',
  '{{data_hoje}}',
];

const AdminODContractForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [form, setForm] = useState({
    name: '',
    html_content: '',
    is_active: true,
    version: 1,
  });

  const isNew = useMemo(() => !id || id === 'novo', [id]);
  const { toasts, push, dismiss } = useToast();

  useEffect(() => {
    if (isNew) return;
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('od_contract_templates')
        .select('name, html_content, is_active, version')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        setForm({
          name: data.name || '',
          html_content: data.html_content || '',
          is_active: !!data.is_active,
          version: data.version || 1,
        });
      }
      setLoading(false);
    };
    load();
  }, [id, isNew]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      push({ title: 'Informe o nome do contrato.', variant: 'error' });
      return;
    }
    setSaving(true);
    if (isNew) {
      const { error } = await (supabase as any)
        .from('od_contract_templates')
        .insert({
          name: form.name.trim(),
          html_content: form.html_content || '',
          is_active: form.is_active,
          version: 1,
        });
      if (!error) {
        push({ title: 'Contrato criado com sucesso.', variant: 'success' });
        navigate('/admin/contratos');
      } else {
        push({ title: 'Erro ao salvar contrato.', description: error.message, variant: 'error' });
      }
    } else {
      const { error } = await (supabase as any)
        .from('od_contract_templates')
        .update({
          name: form.name.trim(),
          html_content: form.html_content || '',
          is_active: form.is_active,
          version: (form.version || 1) + 1,
        })
        .eq('id', id);
      if (!error) {
        push({ title: 'Contrato atualizado.', variant: 'success' });
        setForm((prev) => ({ ...prev, version: (prev.version || 1) + 1 }));
      } else {
        push({ title: 'Erro ao atualizar contrato.', description: error.message, variant: 'error' });
      }
    }
    setSaving(false);
  };

  const handleTagClick = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      push({ title: 'Tag copiada', description: tag, variant: 'success' });
    } catch {
      push({ title: 'Não foi possível copiar.', description: tag, variant: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <ToastStack items={toasts} onDismiss={dismiss} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/contratos')}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isNew ? 'Adicionar contrato' : 'Editar contrato'}
            </h1>
            <p className="text-gray-500">Edite o conteúdo do contrato e use tags dinâmicas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTags(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Tag size={16} />
            Ver tags dinâmicas
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            <Save size={16} />
            Salvar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        {loading ? (
          <div className="text-sm text-gray-400">Carregando...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-gray-600">
                <span>Nome do contrato</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="Ex: Contrato de Assinatura"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Contrato ativo
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-gray-600">Conteúdo do contrato</span>
              <RichTextEditor
                value={form.html_content}
                onChange={(html) => setForm((prev) => ({ ...prev, html_content: html }))}
                minHeight={240}
              />
            </div>
          </>
        )}
      </div>

      {showTags && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowTags(false)} />
          <div className="w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Tags dinâmicas</h2>
              <button
                type="button"
                onClick={() => setShowTags(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                Fechar
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Clique para copiar e cole no editor.
            </p>
            <div className="space-y-2">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminODContractForm;
