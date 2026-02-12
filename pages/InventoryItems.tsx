import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import { useAuth } from '../src/auth/AuthProvider';
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  listSuppliers,
  updateInventoryItem,
} from '../src/lib/inventory/service';
import { inventoryItemSchema, type InventoryItem, type InventoryItemPayload } from '../src/lib/inventory/types';

const InventoryItems: React.FC = () => {
  const { effectiveClinicId } = useAuth();
  const clinicId = effectiveClinicId;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<InventoryItemPayload>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      clinic_id: clinicId || '',
      unit: 'UN',
      consumption_type: 'whole',
    },
  });

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [itemsData, suppliersData] = await Promise.all([
        listInventoryItems(clinicId),
        listSuppliers(clinicId),
      ]);
      setItems(itemsData);
      setSuppliers(suppliersData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const openNew = () => {
    setEditing(null);
    reset({
      clinic_id: clinicId || '',
      unit: 'UN',
      consumption_type: 'whole',
    });
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    reset({
      clinic_id: item.clinic_id,
      name: item.name,
      category: item.category || undefined,
      manufacturer: item.manufacturer || undefined,
      default_supplier_id: item.default_supplier_id || undefined,
      unit: item.unit,
      consumption_type: item.consumption_type as any,
      package_content: item.package_content || undefined,
      rounding_step: item.rounding_step || undefined,
      shelf_life_days: item.shelf_life_days || undefined,
      expires_after_open_hours: item.expires_after_open_hours || undefined,
      storage_type: item.storage_type || undefined,
      notes: item.notes || undefined,
      tax_percent: item.tax_percent || undefined,
      min_stock: item.min_stock || undefined,
      reorder_point: item.reorder_point || undefined,
      max_stock: item.max_stock || undefined,
      lead_time_days: item.lead_time_days || undefined,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: InventoryItemPayload) => {
    if (!clinicId) return;
    if (editing) {
      await updateInventoryItem(editing.id, values);
    } else {
      await createInventoryItem(values);
    }
    setModalOpen(false);
    await loadData();
  };

  const columns = useMemo(
    () => [
      {
        header: 'Item',
        accessorKey: 'name',
      },
      {
        header: 'Categoria',
        accessorKey: 'category',
        cell: ({ row }: any) => row.original.category || '—',
      },
      {
        header: 'Unidade',
        accessorKey: 'unit',
      },
      {
        header: 'Consumo',
        accessorKey: 'consumption_type',
        cell: ({ row }: any) => (row.original.consumption_type === 'fractional' ? 'Fracionado' : 'Inteiro'),
      },
      {
        header: 'Estoque mínimo',
        accessorKey: 'min_stock',
        cell: ({ row }: any) => row.original.min_stock ?? '—',
      },
      {
        header: 'Último custo',
        accessorKey: 'last_cost',
        cell: ({ row }: any) =>
          row.original.last_cost
            ? Number(row.original.last_cost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—',
      },
      {
        header: 'Ações',
        cell: ({ row }: any) => (
          <div className="flex gap-2">
            <button
              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
              onClick={() => openEdit(row.original)}
            >
              Editar
            </button>
            <button
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
              onClick={async () => {
                await deleteInventoryItem(row.original.id);
                await loadData();
              }}
            >
              Remover
            </button>
          </div>
        ),
      },
    ],
    [items]
  );

  const exportCsv = () => {
    const headers = ['nome', 'categoria', 'unidade', 'consumo', 'minimo', 'ponto_reposicao', 'estoque_maximo'];
    const rows = items.map((item) => [
      item.name,
      item.category || '',
      item.unit,
      item.consumption_type,
      item.min_stock ?? '',
      item.reorder_point ?? '',
      item.max_stock ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `itens-estoque-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Catálogo de Itens"
        subtitle="Controle completo de produtos, insumos e medicamentos."
        actions={
          <>
            <button className="rounded-md border border-gray-200 px-3 py-2 text-sm" onClick={exportCsv}>
              Exportar CSV
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
              onClick={openNew}
            >
              <Plus className="h-4 w-4" /> Novo item
            </button>
          </>
        }
      />

      {loading ? (
        <div className="text-sm text-gray-500">Carregando itens...</div>
      ) : (
        <DataTable data={items} columns={columns as any} pageSize={8} />
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? 'Editar item' : 'Novo item'}
                </h3>
                <p className="text-sm text-gray-500">Preencha os dados do item e as regras de estoque.</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 md:grid-cols-2">
              <input type="hidden" {...register('clinic_id')} value={clinicId} />
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('name')} />
                {formState.errors.name && (
                  <p className="text-xs text-rose-500">{formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Categoria</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('category')} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Fornecedor padrão</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('default_supplier_id')}>
                  <option value="">Selecione</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Unidade</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('unit')} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo de consumo</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('consumption_type')}>
                  <option value="whole">Inteiro</option>
                  <option value="fractional">Fracionado</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Conteúdo por embalagem</label>
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('package_content', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Arredondamento</label>
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('rounding_step', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Validade do lote (dias)</label>
                <input type="number" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('shelf_life_days', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Validade após aberto (horas)</label>
                <input type="number" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('expires_after_open_hours', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Estoque mínimo</label>
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('min_stock', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Ponto de reposição</label>
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('reorder_point', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Estoque máximo</label>
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('max_stock', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Lead time (dias)</label>
                <input type="number" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('lead_time_days', { valueAsNumber: true })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <textarea className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" rows={3} {...register('notes')} />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryItems;
