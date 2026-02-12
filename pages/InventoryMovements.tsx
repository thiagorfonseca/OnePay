import React, { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import { useAuth } from '../src/auth/AuthProvider';
import { listInventoryItems, listMovements } from '../src/lib/inventory/service';

const InventoryMovements: React.FC = () => {
  const { effectiveClinicId } = useAuth();
  const clinicId = effectiveClinicId;
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([listInventoryItems(clinicId), listMovements(clinicId, 300)])
      .then(([itemsData, movementsData]) => {
        setItems(itemsData);
        setMovements(movementsData);
      })
      .finally(() => setLoading(false));
  }, [clinicId]);

  const itemNameById = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);

  const columns = useMemo(
    () => [
      { header: 'Data', accessorKey: 'created_at', cell: ({ row }: any) => new Date(row.original.created_at).toLocaleString('pt-BR') },
      { header: 'Tipo', accessorKey: 'movement_type' },
      { header: 'Item', accessorKey: 'item_id', cell: ({ row }: any) => itemNameById.get(row.original.item_id) || '—' },
      { header: 'Qtd', accessorKey: 'qty_delta' },
      { header: 'Lote', accessorKey: 'batch_id', cell: ({ row }: any) => row.original.batch_id?.slice(0, 8) || '—' },
      { header: 'Motivo', accessorKey: 'reason', cell: ({ row }: any) => row.original.reason || '—' },
    ],
    [itemNameById]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Movimentações"
        subtitle="Ledger completo de entradas, consumos, perdas e ajustes."
      />

      {loading ? <div className="text-sm text-gray-500">Carregando movimentações...</div> : <DataTable data={movements} columns={columns as any} pageSize={10} />}
    </div>
  );
};

export default InventoryMovements;
