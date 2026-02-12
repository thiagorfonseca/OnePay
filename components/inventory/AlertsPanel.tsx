import React from 'react';
import type { InventoryAlert } from '../../src/lib/inventory/types';

interface AlertsPanelProps {
  alerts: InventoryAlert[];
  onUpdateStatus?: (id: string, status: 'acknowledged' | 'resolved') => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, onUpdateStatus }) => {
  if (!alerts.length) {
    return <div className="text-sm text-gray-500">Nenhum alerta ativo.</div>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{alert.message}</p>
              <p className="text-xs text-gray-500">
                {alert.alert_type} • {alert.severity} • {new Date(alert.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            {onUpdateStatus ? (
              <div className="flex gap-2">
                {alert.status === 'new' && (
                  <button
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => onUpdateStatus(alert.id, 'acknowledged')}
                  >
                    Reconhecer
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                    onClick={() => onUpdateStatus(alert.id, 'resolved')}
                  >
                    Resolver
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AlertsPanel;
