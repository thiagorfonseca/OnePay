import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

const OnboardingWelcome: React.FC = () => {
  const navigate = useNavigate();
  const { clinicPackageIds } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!clinicPackageIds.length) {
        setPackages([]);
        return;
      }
      const { data } = await (supabase as any)
        .from('content_packages')
        .select('id, name, description')
        .in('id', clinicPackageIds);
      setPackages(data || []);
    };
    load();
  }, [clinicPackageIds]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-2xl w-full space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-emerald-500" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tudo certo, acesso liberado!</h1>
            <p className="text-gray-500">Seu ambiente OnePay já está pronto.</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Produtos/pacotes liberados</h2>
          {packages.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-800">{pkg.name}</div>
                  <div className="text-xs text-gray-500">{pkg.description || 'Pacote ativo'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nenhum pacote encontrado.</div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
          >
            Ir ao dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWelcome;
