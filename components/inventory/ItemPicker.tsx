import React from 'react';
import type { InventoryItem } from '../../src/lib/inventory/types';

interface ItemPickerProps {
  items: InventoryItem[];
  value?: string | null;
  onChange: (itemId: string) => void;
}

const ItemPicker: React.FC<ItemPickerProps> = ({ items, value, onChange }) => {
  return (
    <select
      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Selecione um item</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
};

export default ItemPicker;
