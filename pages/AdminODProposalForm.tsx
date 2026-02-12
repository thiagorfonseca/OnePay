import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { ToastStack } from '../components/Toast';
import { formatCurrency } from '../lib/utils';

const generateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const AdminODProposalForm: React.FC = () => {
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToast();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [savedLink, setSavedLink] = useState('');

  const [form, setForm] = useState({
    direct_link: false,
    requires_signature: true,
    title: '',
    confirmation_text: '',
    product_type: 'platform',
    payment_methods: {
      creditCard: true,
      boleto: false,
      pix: false,
    },
    installments: 1,
    amount: '',
    contract_template_id: '',
    package_id: '',
    client_id: '',
  });

  const amountCents = useMemo(() => {
    const raw = form.amount.replace(/\./g, '').replace(',', '.');
    const value = Number(raw);
    if (Number.isNaN(value)) return 0;
    return Math.round(value * 100);
  }, [form.amount]);

  useEffect(() => {
    const load = async () => {
      const [{ data: tmpl }, { data: pkgs }, { data: cls }] = await Promise.all([
        (supabase as any)
          .from('od_contract_templates')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('content_packages')
          .select('id, name')
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('od_clients')
          .select('id, legal_name, trade_name')
          .order('created_at', { ascending: false }),
      ]);
      setTemplates(tmpl || []);
      setPackages(pkgs || []);
      setClients(cls || []);
    };
    load();
  }, []);

  const publicUrl = savedLink || '';

  const handleSave = async () => {
    if (!form.title.trim()) {
      push({ title: 'Informe o título da proposta.', variant: 'error' });
      return;
    }
    if (!amountCents) {
      push({ title: 'Informe o valor da proposta.', variant: 'error' });
      return;
    }

    setSaving(true);
    const token = generateToken();

    const { data, error } = await (supabase as any)
      .from('od_proposals')
      .insert({
        title: form.title.trim(),
        direct_link: form.direct_link,
        requires_signature: form.requires_signature,
        confirmation_text: form.confirmation_text || null,
        product_type: form.product_type,
        payment_methods: form.payment_methods,
        installments: form.payment_methods.creditCard ? form.installments || 1 : null,
        amount_cents: amountCents,
        contract_template_id: form.contract_template_id || null,
        package_id: form.package_id || null,
        client_id: form.client_id || null,
        status: 'sent',
        public_token: token,
      })
      .select('id, public_token')
      .single();

    setSaving(false);

    if (error) {
      push({ title: 'Erro ao salvar proposta.', description: error.message, variant: 'error' });
      return;
    }

    const link = `${window.location.origin}/cadastro/${data.public_token}`;
    setSavedLink(link);
    push({ title: 'Proposta criada!', variant: 'success' });
    navigate(`/admin/propostas/${data.id}`);
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      push({ title: 'Link copiado', variant: 'success' });
    } catch {
      push({ title: 'Não foi possível copiar.', variant: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <ToastStack items={toasts} onDismiss={dismiss} />
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Nova proposta</h1>
        <p className="text-gray-500">Crie uma proposta comercial e gere o link público.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 text-sm text-gray-600">
            <span>Link Direto</span>
            <select
              value={form.direct_link ? 'sim' : 'nao'}
              onChange={(e) => setForm((prev) => ({ ...prev, direct_link: e.target.value === 'sim' }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-gray-600">
            <span>Assinar Contrato</span>
            <select
              value={form.requires_signature ? 'sim' : 'nao'}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_signature: e.target.value === 'sim' }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
            <span>Nome / Título da proposta</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Ex: Plano OneDoctor Premium"
            />
          </label>

          <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
            <span>Texto de confirmação</span>
            <textarea
              value={form.confirmation_text}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmation_text: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </label>

          <label className="space-y-2 text-sm text-gray-600">
            <span>Tipo de produto</span>
            <select
              value={form.product_type}
              onChange={(e) => setForm((prev) => ({ ...prev, product_type: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="platform">Venda de Plataforma</option>
              <option value="course">Curso</option>
              <option value="other">Outros</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-gray-600">
            <span>Valor</span>
            <input
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="0,00"
            />
            <span className="text-xs text-gray-400">{amountCents ? formatCurrency(amountCents / 100) : ''}</span>
          </label>

          <div className="space-y-2 text-sm text-gray-600">
            <span>Forma de pagamento</span>
            <div className="flex flex-wrap gap-3">
              {['creditCard', 'boleto', 'pix'].map((key) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(form.payment_methods as any)[key]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        payment_methods: { ...prev.payment_methods, [key]: e.target.checked },
                      }))
                    }
                  />
                  {key === 'creditCard' ? 'Cartão' : key === 'boleto' ? 'Boleto' : 'Pix'}
                </label>
              ))}
            </div>
          </div>

          {form.payment_methods.creditCard && (
            <label className="space-y-2 text-sm text-gray-600">
              <span>Qtd. Parcelas</span>
              <input
                type="number"
                min={1}
                value={form.installments}
                onChange={(e) => setForm((prev) => ({ ...prev, installments: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
          )}

          <label className="space-y-2 text-sm text-gray-600">
            <span>Contrato</span>
            <select
              value={form.contract_template_id}
              onChange={(e) => setForm((prev) => ({ ...prev, contract_template_id: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">Sem contrato</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-gray-600">
            <span>Pacote</span>
            <select
              value={form.package_id}
              onChange={(e) => setForm((prev) => ({ ...prev, package_id: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">Sem pacote</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-gray-600">
            <span>Cliente (opcional)</span>
            <select
              value={form.client_id}
              onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">Selecionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.trade_name || client.legal_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-500">Revise os dados antes de salvar.</div>
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

      {publicUrl ? (
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            Link público gerado:
            <div className="font-medium text-gray-800 break-all">{publicUrl}</div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Copy size={16} />
            Copiar link
          </button>
        </div>
      ) : null}

      {saving ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Check size={16} />
          Salvando...
        </div>
      ) : null}
    </div>
  );
};

export default AdminODProposalForm;
