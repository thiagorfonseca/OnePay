import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Calendar, Wallet, Flame } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import AlertsPanel from '../components/inventory/AlertsPanel';
import { useAuth } from '../src/auth/AuthProvider';
import {
  listAlerts,
  listBatchStock,
  listInventoryItems,
  listItemStock,
  listMovements,
} from '../src/lib/inventory/service';
import type { InventoryAlert } from '../src/lib/inventory/types';

const InventoryDashboard: React.FC = () => {
  const { effectiveClinicId } = useAuth();
  const clinicId = effectiveClinicId;
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [itemStock, setItemStock] = useState<any[]>([]);
  const [batchStock, setBatchStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([
      listAlerts(clinicId),
      listInventoryItems(clinicId),
      listItemStock(clinicId),
      listBatchStock(clinicId),
      listMovements(clinicId, 400),
    ])
      .then(([alertsData, itemsData, itemStockData, batchStockData, movementsData]) => {
        setAlerts(alertsData);
        setItems(itemsData);
        setItemStock(itemStockData);
        setBatchStock(batchStockData);
        setMovements(movementsData);
      })
      .finally(() => setLoading(false));
  }, [clinicId]);

  const metrics = useMemo(() => {
    const itemStockMap = new Map(itemStock.map((row: any) => [row.item_id, row]));
    const criticalItems = items.filter((item) => {
      const stock = itemStockMap.get(item.id)?.qty_on_hand ?? 0;
      const min = item.min_stock ?? item.reorder_point ?? 0;
      return min > 0 && stock < min;
    });

    const expiringSoon = batchStock.filter((batch: any) => {
      if (!batch.expiry_date) return false;
      if ((batch.qty_on_hand ?? 0) <= 0) return false;
      const diff = new Date(batch.expiry_date).getTime() - Date.now();
      return diff <= 1000 * 60 * 60 * 24 * 30;
    });

    const stockValue = itemStock.reduce((sum: number, row: any) => sum + (row.stock_value || 0), 0);

    const lossesMonth = movements
      .filter((m: any) => m.movement_type === 'loss')
      .filter((m: any) => new Date(m.created_at).getMonth() === new Date().getMonth())
      .reduce((sum: number, m: any) => sum + Math.abs(Number(m.qty_delta || 0)), 0);

    const consumption = movements.filter((m: any) => m.movement_type === 'consumption');
    const consumptionMap = new Map<string, number>();
    consumption.forEach((m: any) => {
      const current = consumptionMap.get(m.item_id) || 0;
      consumptionMap.set(m.item_id, current + Math.abs(Number(m.qty_delta || 0)));
    });
    const topConsumed = Array.from(consumptionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([itemId, qty]) => {
        const item = items.find((i) => i.id === itemId);
        return { name: item?.name || 'Item', qty };
      });

    return {
      criticalItems,
      expiringSoon,
      stockValue,
      lossesMonth,
      topConsumed,
    };
  }, [items, itemStock, batchStock, movements]);

  const recommendedActions = useMemo(() => {
    const actions: string[] = [];
    if (metrics.criticalItems.length) actions.push('Itens abaixo do mínimo: revisar reposição agora.');
    if (metrics.expiringSoon.length) actions.push('Lotes vencendo em 30 dias: priorizar FEFO e revisar validade.');
    if (metrics.lossesMonth > 0) actions.push('Perdas registradas neste mês: revisar causas e abrir ajuste.');
    if (!actions.length) actions.push('Estoque saudável. Revisar alertas semanais para evitar rupturas.');
    return actions;
  }, [metrics]);

  if (!clinicId) return null;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard de Estoque"
        subtitle="KPIs críticos, alertas e ações recomendadas para manter a clínica abastecida."
      />

      {loading ? (
        <div className="text-sm text-gray-500">Carregando dados do estoque...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertTriangle className="h-4 w-4" /> Itens críticos
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{metrics.criticalItems.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" /> Vencendo em 30 dias
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{metrics.expiringSoon.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Wallet className="h-4 w-4" /> Valor em estoque
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {metrics.stockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Boxes className="h-4 w-4" /> Perdas do mês
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{metrics.lossesMonth}</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Flame className="h-4 w-4" /> Itens mais consumidos
              </div>
              <div className="mt-4 space-y-2">
                {metrics.topConsumed.length ? (
                  metrics.topConsumed.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-500">{item.qty}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Nenhum consumo registrado.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-700">Ações recomendadas</div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {recommendedActions.map((action) => (
                  <li key={action}>• {action}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <AlertTriangle className="h-4 w-4" /> Alertas ativos
            </div>
            <div className="mt-4">
              <AlertsPanel alerts={alerts.filter((a) => a.status !== 'resolved').slice(0, 6)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryDashboard;
