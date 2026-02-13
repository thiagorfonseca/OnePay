import React, { useState } from 'react';
import AnalyticsArchetypePage from '../src/features/archetype/pages/AnalyticsArchetypePage';
import PublicLinksManagementPage from '../src/features/archetype/pages/PublicLinksManagementPage';

const HRArchetypes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'links'>('analytics');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {activeTab === 'links' ? 'Links de Perfil' : 'Arquétipos'}
          </h1>
          <p className="text-gray-500">
            {activeTab === 'links'
              ? 'Recursos Humanos • Links do teste comportamental'
              : 'Recursos Humanos • Perfil comportamental'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-sm border ${
              activeTab === 'analytics'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Resultados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`px-4 py-2 rounded-lg text-sm border ${
              activeTab === 'links'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Links do formulário
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? <AnalyticsArchetypePage /> : <PublicLinksManagementPage />}
    </div>
  );
};

export default HRArchetypes;
