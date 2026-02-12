import React, { useEffect, useState } from 'react';
import SectionHeader from '../components/inventory/SectionHeader';
import AlertsPanel from '../components/inventory/AlertsPanel';
import { useAuth } from '../src/auth/AuthProvider';
import { listAlerts, updateAlertStatus } from '../src/lib/inventory/service';

const InventoryAlerts: React.FC = () => {
  const { effectiveClinicId, session } = useAuth();
  const clinicId = effectiveClinicId;
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await listAlerts(clinicId);
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clinicId]);

  const triggerAlerts = async () => {
    if (!clinicId || !session) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clinic_id: clinicId }),
    });
    await load();
  };

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Central de Alertas"
        subtitle="Baixo estoque, validade, perdas e variações de preço em tempo real."
        actions={
          <button className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={triggerAlerts}>
            Atualizar alertas
          </button>
        }
      />

      {loading ? (
        <div className="text-sm text-gray-500">Carregando alertas...</div>
      ) : (
        <AlertsPanel
          alerts={alerts}
          onUpdateStatus={async (id, status) => {
            await updateAlertStatus(id, status);
            await load();
          }}
        />
      )}
    </div>
  );
};

export default InventoryAlerts;
