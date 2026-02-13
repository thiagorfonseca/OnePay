import React from 'react';
import type { ArchetypeRespondentRow } from '../types';
import { formatDate } from '../../../../lib/utils';

interface RespondentsTableProps {
  rows: ArchetypeRespondentRow[];
  onOpenDetails: (row: ArchetypeRespondentRow) => void;
}

const RespondentsTable: React.FC<RespondentsTableProps> = ({ rows, onOpenDetails }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="table-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">WhatsApp</th>
              <th className="text-left px-4 py-3">Audiência</th>
              <th className="text-left px-4 py-3">Perfil</th>
              <th className="text-left px-4 py-3">Token</th>
              <th className="text-left px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                <td className="px-4 py-3">{row.email || '-'}</td>
                <td className="px-4 py-3">{row.phone || '-'}</td>
                <td className="px-4 py-3">{row.audience_type === 'INTERNAL' ? 'Interno' : 'Externo'}</td>
                <td className="px-4 py-3 font-semibold text-gray-700">{row.top_profile}</td>
                <td className="px-4 py-3">{row.public_token}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(row)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Ver detalhes
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={8}>
                  Nenhum respondente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RespondentsTable;
