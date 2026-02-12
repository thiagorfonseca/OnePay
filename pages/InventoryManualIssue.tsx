import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import SectionHeader from '../components/inventory/SectionHeader';
import ItemPicker from '../components/inventory/ItemPicker';
import BatchPicker from '../components/inventory/BatchPicker';
import BarcodeScannerModal from '../components/inventory/BarcodeScannerModal';
import { useAuth } from '../src/auth/AuthProvider';
import {
  createMovement,
  listBatchStock,
  listInventoryItems,
  listOpenContainers,
  openContainer,
  searchItemByBarcode,
} from '../src/lib/inventory/service';
import { computeExpiresAt } from '../src/lib/inventory/utils';
import type { InventoryItem } from '../src/lib/inventory/types';

interface ManualIssueForm {
  item_id: string;
  batch_id?: string;
  open_container_id?: string;
  movement_type: 'consumption' | 'loss';
  qty: number;
  reason: string;
  open_new_container: boolean;
}

const InventoryManualIssue: React.FC = () => {
  const { effectiveClinicId, user } = useAuth();
  const clinicId = effectiveClinicId;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batchStock, setBatchStock] = useState<any[]>([]);
  const [openContainers, setOpenContainers] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, watch, setValue, reset } = useForm<ManualIssueForm>({
    defaultValues: {
      movement_type: 'consumption',
      qty: 1,
      reason: '',
      open_new_container: false,
    },
  });

  const itemId = watch('item_id');

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([listInventoryItems(clinicId), listBatchStock(clinicId), listOpenContainers(clinicId)])
      .then(([itemsData, batchStockData, openContainersData]) => {
        setItems(itemsData);
        setBatchStock(batchStockData);
        setOpenContainers(openContainersData);
      })
      .finally(() => setLoading(false));
  }, [clinicId]);

  const selectedItem = useMemo(() => items.find((item) => item.id === itemId) || null, [items, itemId]);

  const batchesForItem = useMemo(() => {
    return batchStock
      .filter((batch: any) => batch.item_id === itemId && (batch.qty_on_hand ?? 0) > 0)
      .sort((a: any, b: any) => {
        const aTime = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [batchStock, itemId]);

  useEffect(() => {
    if (batchesForItem.length) {
      setValue('batch_id', batchesForItem[0].batch_id);
    }
  }, [batchesForItem, setValue]);

  const openContainersForItem = useMemo(() => {
    return openContainers.filter((container: any) => container.item_id === itemId && (container.remaining_qty ?? 0) > 0);
  }, [openContainers, itemId]);

  const onSubmit = async (values: ManualIssueForm) => {
    if (!clinicId || !user) return;

    let openContainerId = values.open_container_id || null;

    if (selectedItem?.consumption_type === 'fractional' && values.open_new_container) {
      const totalQty = selectedItem.package_content || values.qty || 0;
      const expiresAt = computeExpiresAt(new Date(), selectedItem.expires_after_open_hours || undefined);
      const container = await openContainer({
        clinic_id: clinicId,
        item_id: selectedItem.id,
        batch_id: values.batch_id || null,
        total_qty: totalQty,
        opened_by: user.id,
        expires_at: expiresAt,
      });
      openContainerId = container.id;
    }

    await createMovement({
      clinic_id: clinicId,
      item_id: values.item_id,
      batch_id: values.batch_id || null,
      open_container_id: openContainerId,
      movement_type: values.movement_type,
      qty_delta: -Math.abs(values.qty),
      unit_cost: null,
      reason: values.reason || 'baixa_manual',
      reference_type: 'manual',
      created_by: user.id,
    });

    reset({ movement_type: 'consumption', qty: 1, reason: '', open_new_container: false, item_id: '' });
  };

  const handleBarcode = async (code: string) => {
    if (!clinicId) return;
    const data = await searchItemByBarcode(clinicId, code);
    if (data?.item_id) {
      setValue('item_id', data.item_id);
    }
  };

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Baixa Manual"
        subtitle="Registre consumo ou perdas. FEFO é sugerido automaticamente por lote."
        actions={
          <button
            className="rounded-md border border-gray-200 px-4 py-2 text-sm"
            onClick={() => setScannerOpen(true)}
          >
            Escanear código
          </button>
        }
      />

      {loading ? (
        <div className="text-sm text-gray-500">Carregando dados...</div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Item</label>
            <ItemPicker items={items} value={itemId} onChange={(value) => setValue('item_id', value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Tipo de baixa</label>
            <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('movement_type')}>
              <option value="consumption">Consumo</option>
              <option value="loss">Perda</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Quantidade</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('qty', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Lote (FEFO)</label>
            <BatchPicker batches={batchesForItem} value={watch('batch_id')} onChange={(value) => setValue('batch_id', value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Motivo/Observação</label>
            <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('reason')} />
          </div>

          {selectedItem?.consumption_type === 'fractional' ? (
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" {...register('open_new_container')} /> Abrir novo frasco
              </label>
              {openContainersForItem.length ? (
                <select className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('open_container_id')}>
                  <option value="">Selecionar frasco aberto</option>
                  {openContainersForItem.map((container: any) => (
                    <option key={container.id} value={container.id}>
                      {container.id.slice(0, 6)} • Restante: {container.remaining_qty} • Expira: {container.expires_at || 'N/A'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500">Nenhum frasco aberto disponível.</p>
              )}
            </div>
          ) : null}

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
              Registrar baixa
            </button>
          </div>
        </form>
      )}

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(code) => {
        setScannerOpen(false);
        handleBarcode(code);
      }} />
    </div>
  );
};

export default InventoryManualIssue;
