import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import { useAuth } from '../src/auth/AuthProvider';
import { listSuppliers, upsertSupplier, deleteSupplier } from '../src/lib/inventory/service';

const InventorySuppliers: React.FC = () => {
  const { effectiveClinicId } = useAuth();
  const clinicId = effectiveClinicId;
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nome: '',
    contato_nome: '',
    email: '',
    telefone: '',
    cnpj: '',
    lead_time_days: '',
    observacoes: '',
  });

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await listSuppliers(clinicId);
      setSuppliers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const openNew = () => {
    setEditing(null);
    setForm({
      nome: '',
      contato_nome: '',
      email: '',
      telefone: '',
      cnpj: '',
      lead_time_days: '',
      observacoes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (supplier: any) => {
    setEditing(supplier);
    setForm({
      nome: supplier.nome || '',
      contato_nome: supplier.contato_nome || '',
      email: supplier.email || '',
      telefone: supplier.telefone || '',
      cnpj: supplier.cnpj || '',
      lead_time_days: supplier.lead_time_days?.toString() || '',
      observacoes: supplier.observacoes || '',
    });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    if (!clinicId) return;
    const payload = {
      ...form,
      clinic_id: clinicId,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      id: editing?.id,
    };
    await upsertSupplier(payload);
    setModalOpen(false);
    await loadData();
  };

  const columns = useMemo(
    () => [
      { header: 'Fornecedor', accessorKey: 'nome' },
      { header: 'Contato', accessorKey: 'contato_nome', cell: ({ row }: any) => row.original.contato_nome || '—' },
      { header: 'Email', accessorKey: 'email', cell: ({ row }: any) => row.original.email || '—' },
      { header: 'Lead time', accessorKey: 'lead_time_days', cell: ({ row }: any) => row.original.lead_time_days || '—' },
      {
        header: 'Ações',
        cell: ({ row }: any) => (
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-200 px-2 py-1 text-xs" onClick={() => openEdit(row.original)}>
              Editar
            </button>
            <button
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
              onClick={async () => {
                await deleteSupplier(row.original.id);
                await loadData();
              }}
            >
              Remover
            </button>
          </div>
        ),
      },
    ],
    [suppliers]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Fornecedores"
        subtitle="Cadastre contatos e acompanhe histórico de compras."
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
            onClick={openNew}
          >
            <Plus className="h-4 w-4" /> Novo fornecedor
          </button>
        }
      />

      {loading ? <div className="text-sm text-gray-500">Carregando fornecedores...</div> : <DataTable data={suppliers} columns={columns as any} />}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
                <p className="text-sm text-gray-500">Informações comerciais e lead time.</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Contato</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.contato_nome} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Email</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Telefone</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">CNPJ</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Lead time (dias)</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <textarea className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" onClick={onSubmit}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventorySuppliers;
