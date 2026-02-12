import React, { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import { useAuth } from '../src/auth/AuthProvider';
import { listBatchStock, listInventoryItems, listItemStock, listOpenContainers } from '../src/lib/inventory/service';

const InventoryStock: React.FC = () => {
  const { effectiveClinicId } = useAuth();
  const clinicId = effectiveClinicId;
  const [items, setItems] = useState<any[]>([]);
  const [itemStock, setItemStock] = useState<any[]>([]);
  const [batchStock, setBatchStock] = useState<any[]>([]);
  const [openContainers, setOpenContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([
      listInventoryItems(clinicId),
      listItemStock(clinicId),
      listBatchStock(clinicId),
      listOpenContainers(clinicId),
    ])
      .then(([itemsData, itemStockData, batchStockData, openContainersData]) => {
        setItems(itemsData);
        setItemStock(itemStockData);
        setBatchStock(batchStockData);
        setOpenContainers(openContainersData);
      })
      .finally(() => setLoading(false));
  }, [clinicId]);

  const itemRows = useMemo(() => {
    const stockMap = new Map(itemStock.map((row: any) => [row.item_id, row]));
    return items.map((item) => ({
      ...item,
      qty_on_hand: stockMap.get(item.id)?.qty_on_hand ?? 0,
      stock_value: stockMap.get(item.id)?.stock_value ?? 0,
    }));
  }, [items, itemStock]);

  const itemColumns = useMemo(
    () => [
      { header: 'Item', accessorKey: 'name' },
      { header: 'Saldo', accessorKey: 'qty_on_hand' },
      {
        header: 'Valor',
        accessorKey: 'stock_value',
        cell: ({ row }: any) =>
          Number(row.original.stock_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      },
      { header: 'Unidade', accessorKey: 'unit' },
    ],
    []
  );

  const itemNameById = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);

  const batchColumns = useMemo(
    () => [
      { header: 'Lote', accessorKey: 'batch_id' },
      { header: 'Item', accessorKey: 'item_id', cell: ({ row }: any) => itemNameById.get(row.original.item_id) || '—' },
      { header: 'Validade', accessorKey: 'expiry_date', cell: ({ row }: any) => row.original.expiry_date || '—' },
      { header: 'Saldo', accessorKey: 'qty_on_hand' },
    ],
    [itemNameById]
  );

  const containerColumns = useMemo(
    () => [
      { header: 'Container', accessorKey: 'id' },
      { header: 'Item', accessorKey: 'item_id', cell: ({ row }: any) => itemNameById.get(row.original.item_id) || '—' },
      { header: 'Aberto em', accessorKey: 'opened_at' },
      { header: 'Expira em', accessorKey: 'expires_at', cell: ({ row }: any) => row.original.expires_at || '—' },
      { header: 'Saldo', accessorKey: 'remaining_qty' },
    ],
    [itemNameById]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Estoque e Lotes"
        subtitle="Visão consolidada por item, por lote e por frasco aberto."
      />

      {loading ? (
        <div className="text-sm text-gray-500">Carregando estoque...</div>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Saldo por item</h3>
            <DataTable data={itemRows} columns={itemColumns as any} pageSize={10} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Saldo por lote</h3>
            <DataTable data={batchStock} columns={batchColumns as any} pageSize={8} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Frascos abertos</h3>
            <DataTable data={openContainers} columns={containerColumns as any} pageSize={8} />
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryStock;
