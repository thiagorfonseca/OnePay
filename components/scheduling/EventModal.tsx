import React from 'react';
import { CalendarClock, Link as LinkIcon, MapPin, Sparkles } from 'lucide-react';
import { useModalControls } from '../../hooks/useModalControls';
import type { SuggestedSlot } from '../../src/lib/scheduling/types';

export type EventFormState = {
  title: string;
  description: string;
  start: string;
  end: string;
  timezone: string;
  location: string;
  meeting_url: string;
};

type ClinicOption = {
  id: string;
  name: string;
};

type EventModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  form: EventFormState;
  clinics: ClinicOption[];
  selectedClinics: string[];
  suggestions: SuggestedSlot[];
  saving: boolean;
  suggesting: boolean;
  onChange: (patch: Partial<EventFormState>) => void;
  onToggleClinic: (id: string) => void;
  onSave: () => void;
  onSuggest: () => void;
  onClose: () => void;
};

const EventModal: React.FC<EventModalProps> = ({
  open,
  mode,
  form,
  clinics,
  selectedClinics,
  suggestions,
  saving,
  suggesting,
  onChange,
  onToggleClinic,
  onSave,
  onSuggest,
  onClose,
}) => {
  const modalControls = useModalControls({ isOpen: open, onClose });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8"
      onClick={modalControls.onBackdropClick}
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {mode === 'create' ? 'Criar agendamento' : 'Editar agendamento'}
            </h3>
            <p className="text-sm text-gray-500">Defina os detalhes do encontro e as clínicas participantes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Título *</label>
            <input
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Ex: Reunião mensal de alinhamento"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Início *</label>
            <input
              type="datetime-local"
              value={form.start}
              onChange={(e) => onChange({ start: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fim *</label>
            <input
              type="datetime-local"
              value={form.end}
              onChange={(e) => onChange({ end: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fuso horário</label>
            <input
              value={form.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin size={14} /> Local
            </label>
            <input
              value={form.location}
              onChange={(e) => onChange({ location: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Sala, endereço ou remoto"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <LinkIcon size={14} /> Link do evento
            </label>
            <input
              value={form.meeting_url}
              onChange={(e) => onChange({ meeting_url: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="https://meet.google.com/..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg min-h-[90px]"
              placeholder="Agenda, pauta, objetivos..."
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Clínicas participantes</p>
              <p className="text-xs text-gray-500">Selecione uma ou mais clínicas para o evento.</p>
            </div>
            <span className="text-xs text-gray-400">{selectedClinics.length} selecionadas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-auto">
            {clinics.map((clinic) => (
              <label key={clinic.id} className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedClinics.includes(clinic.id)}
                  onChange={() => onToggleClinic(clinic.id)}
                />
                <span>{clinic.name}</span>
              </label>
            ))}
            {clinics.length === 0 && (
              <p className="text-xs text-gray-400">Nenhuma clínica disponível.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <CalendarClock size={16} /> Sugestões inteligentes
            </div>
            <button
              type="button"
              onClick={onSuggest}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50"
              disabled={suggesting}
            >
              <Sparkles size={14} /> {suggesting ? 'Buscando...' : 'Sugerir horários'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.length === 0 && (
              <p className="text-xs text-gray-500">Clique em “Sugerir horários” para ver opções livres.</p>
            )}
            {suggestions.map((slot) => (
              <button
                type="button"
                key={slot.start}
                onClick={() => onChange({
                  start: slot.start.slice(0, 16),
                  end: slot.end.slice(0, 16),
                })}
                className="px-3 py-1 rounded-full text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {new Date(slot.start).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </button>
            ))}
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
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
