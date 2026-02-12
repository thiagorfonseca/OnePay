import React from 'react';
import { X } from 'lucide-react';
import type { ToastItem } from '../hooks/useToast';

const variantStyles: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-gray-200 bg-white text-gray-700',
};

export const ToastStack: React.FC<{ items: ToastItem[]; onDismiss: (id: string) => void }> = ({ items, onDismiss }) => {
  if (!items.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`w-80 rounded-xl border px-4 py-3 shadow-lg ${variantStyles[item.variant || 'info']}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description ? <p className="mt-1 text-xs text-gray-500">{item.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
