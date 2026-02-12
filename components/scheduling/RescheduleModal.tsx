import React from 'react';
import { useModalControls } from '../../hooks/useModalControls';

type RescheduleModalProps = {
  open: boolean;
  reason: string;
  suggestedStart: string;
  suggestedEnd: string;
  submitting: boolean;
  onChange: (patch: { reason?: string; suggestedStart?: string; suggestedEnd?: string }) => void;
  onSubmit: () => void;
  onClose: () => void;
};

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  open,
  reason,
  suggestedStart,
  suggestedEnd,
  submitting,
  onChange,
  onSubmit,
  onClose,
}) => {
  const modalControls = useModalControls({ isOpen: open, onClose });
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8"
      onClick={modalControls.onBackdropClick}
    >
      <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Solicitar reagendamento</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Motivo *</label>
          <textarea
            value={reason}
            onChange={(e) => onChange({ reason: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg min-h-[90px]"
            placeholder="Explique o motivo do reagendamento"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Sugestão de início (opcional)</label>
            <input
              type="datetime-local"
              value={suggestedStart}
              onChange={(e) => onChange({ suggestedStart: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Sugestão de fim (opcional)</label>
            <input
              type="datetime-local"
              value={suggestedEnd}
              onChange={(e) => onChange({ suggestedEnd: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
