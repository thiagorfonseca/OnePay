import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../src/auth/AuthProvider';

interface Clinic {
  id: string;
  name: string;
}

const ClinicSwitcher: React.FC = () => {
  const { isSystemAdmin, selectedClinicId, setSelectedClinicId } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSystemAdmin) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .order('created_at', { ascending: false });
      setClinics(data || []);
      setLoading(false);
    };
    load();
  }, [isSystemAdmin]);

  if (!isSystemAdmin) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">Clínica:</span>
      <select
        value={selectedClinicId || ''}
        onChange={(e) => setSelectedClinicId(e.target.value || null)}
        className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
      >
        <option value="">Todas</option>
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {loading && <span className="text-xs text-gray-400">Carregando...</span>}
    </div>
  );
};

export default ClinicSwitcher;
