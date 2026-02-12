import React from 'react';
import type { InventoryBatchStock } from '../../src/lib/inventory/types';

interface BatchPickerProps {
  batches: InventoryBatchStock[];
  value?: string | null;
  onChange: (batchId: string) => void;
}

const BatchPicker: React.FC<BatchPickerProps> = ({ batches, value, onChange }) => {
  return (
    <select
      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Selecionar lote (FEFO sugerido)</option>
      {batches.map((batch) => (
        <option key={batch.batch_id} value={batch.batch_id}>
          {batch.batch_id.slice(0, 8)} | Vence: {batch.expiry_date || 'N/A'} | Saldo: {batch.qty_on_hand}
        </option>
      ))}
    </select>
  );
};

export default BatchPicker;
