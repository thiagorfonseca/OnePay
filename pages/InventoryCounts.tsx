import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import ItemPicker from '../components/inventory/ItemPicker';
import { useAuth } from '../src/auth/AuthProvider';
import {
  addInventoryCountLines,
  approveInventoryCount,
  createInventoryCount,
  listInventoryCounts,
  listInventoryItems,
  listItemStock,
  submitInventoryCount,
} from '../src/lib/inventory/service';

interface CountLineDraft {
  item_id: string;
  counted_qty: number;
  expected_qty: number;
  diff_qty: number;
}

const InventoryCounts: React.FC = () => {
  const { effectiveClinicId, user } = useAuth();
  const clinicId = effectiveClinicId;
  const [counts, setCounts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [itemStock, setItemStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState<any | null>(null);
  const [countDate, setCountDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CountLineDraft[]>([{ item_id: '', counted_qty: 0, expected_qty: 0, diff_qty: 0 }]);

  const stockMap = useMemo(() => new Map(itemStock.map((row: any) => [row.item_id, row.qty_on_hand || 0])), [itemStock]);

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [countsData, itemsData, stockData] = await Promise.all([
        listInventoryCounts(clinicId),
        listInventoryItems(clinicId),
        listItemStock(clinicId),
      ]);
      setCounts(countsData);
      setItems(itemsData);
      setItemStock(stockData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const updateLineItem = (index: number, itemId: string) => {
    const expected = stockMap.get(itemId) || 0;
    const next = [...lines];
    next[index] = {
      ...next[index],
      item_id: itemId,
      expected_qty: expected,
      diff_qty: (next[index].counted_qty || 0) - expected,
    };
    setLines(next);
  };

  const updateLineCounted = (index: number, counted: number) => {
    const next = [...lines];
    const expected = next[index].expected_qty || 0;
    next[index] = {
      ...next[index],
      counted_qty: counted,
      diff_qty: counted - expected,
    };
    setLines(next);
  };

  const addLine = () => setLines([...lines, { item_id: '', counted_qty: 0, expected_qty: 0, diff_qty: 0 }]);

  const saveCount = async () => {
    if (!clinicId || !user) return;
    const count = await createInventoryCount({
      clinic_id: clinicId,
      count_date: countDate,
      status: 'draft',
      notes,
      created_by: user.id,
    });

    const payload = lines
      .filter((line) => line.item_id)
      .map((line) => ({
        clinic_id: clinicId,
        count_id: count.id,
        item_id: line.item_id,
        expected_qty: line.expected_qty,
        counted_qty: line.counted_qty,
        diff_qty: line.diff_qty,
      }));

    if (payload.length) {
      await addInventoryCountLines(payload);
    }

    setModalOpen(false);
    setLines([{ item_id: '', counted_qty: 0, expected_qty: 0, diff_qty: 0 }]);
    setNotes('');
    await loadData();
  };

  const columns = useMemo(
    () => [
      { header: 'Data', accessorKey: 'count_date' },
      { header: 'Status', accessorKey: 'status' },
      { header: 'Linhas', accessorKey: 'inventory_count_lines', cell: ({ row }: any) => row.original.inventory_count_lines?.length || 0 },
      {
        header: 'Ações',
        cell: ({ row }: any) => (
          <div className="flex gap-2">
            <button
              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
              onClick={() => {
                setSelectedCount(row.original);
                setDetailOpen(true);
              }}
            >
              Detalhar
            </button>
            {row.original.status === 'draft' ? (
              <button
                className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700"
                onClick={async () => {
                  await submitInventoryCount(row.original.id);
                  await loadData();
                }}
              >
                Enviar
              </button>
            ) : null}
            {row.original.status === 'submitted' ? (
              <button
                className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                onClick={async () => {
                  await approveInventoryCount(row.original.id);
                  await loadData();
                }}
              >
                Aprovar
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [counts]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contagem Cíclica"
        subtitle="Registre divergências e aprove para gerar ajustes automáticos."
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" /> Nova contagem
          </button>
        }
      />

      {loading ? <div className="text-sm text-gray-500">Carregando contagens...</div> : <DataTable data={counts} columns={columns as any} />}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nova contagem</h3>
                <p className="text-sm text-gray-500">Informe os itens contados e as divergências.</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Data</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={countDate}
                  onChange={(e) => setCountDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Item</label>
                    <ItemPicker items={items} value={line.item_id} onChange={(value) => updateLineItem(index, value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Esperado</label>
                    <input
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                      value={line.expected_qty}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Contado</label>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                      value={line.counted_qty}
                      onChange={(e) => updateLineCounted(index, Number(e.target.value || 0))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Diferença</label>
                    <input
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                      value={line.diff_qty}
                      readOnly
                    />
                  </div>
                </div>
              ))}
              <button className="rounded-md border border-gray-200 px-3 py-2 text-xs" onClick={addLine}>
                Adicionar item
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" onClick={saveCount}>
                Salvar contagem
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && selectedCount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Detalhes da contagem</h3>
                <p className="text-sm text-gray-500">Status: {selectedCount.status}</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setDetailOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {(selectedCount.inventory_count_lines || []).map((line: any) => (
                <div key={line.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span>{items.find((item) => item.id === line.item_id)?.name || 'Item'}</span>
                  <span>Esperado: {line.expected_qty ?? 0}</span>
                  <span>Contado: {line.counted_qty ?? 0}</span>
                  <span>Dif: {line.diff_qty ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryCounts;
