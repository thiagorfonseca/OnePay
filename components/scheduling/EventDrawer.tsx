import React from 'react';
import { Calendar, Link as LinkIcon, MapPin, Users } from 'lucide-react';
import { useModalControls } from '../../hooks/useModalControls';
import type { ScheduleChangeRequest, ScheduleEventAttendee, ScheduleEventForClinic, ScheduleEventWithAttendees } from '../../src/lib/scheduling/types';

type EventDrawerProps = {
  open: boolean;
  onClose: () => void;
  event: ScheduleEventWithAttendees | ScheduleEventForClinic | null;
  attendees?: ScheduleEventAttendee[];
  changeRequests?: ScheduleChangeRequest[];
  clinicView?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  onRequestReschedule?: () => void;
};

const EventDrawer: React.FC<EventDrawerProps> = ({
  open,
  onClose,
  event,
  attendees = [],
  changeRequests = [],
  clinicView = false,
  onEdit,
  onCancel,
  onConfirm,
  onRequestReschedule,
}) => {
  const modalControls = useModalControls({ isOpen: open, onClose });
  if (!open || !event) return null;

  const startLabel = new Date(event.start_at).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
  const endLabel = new Date(event.end_at).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex justify-end"
      onClick={modalControls.onBackdropClick}
    >
      <div
        className="bg-white w-full max-w-lg h-full shadow-xl p-6 space-y-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{event.title}</h3>
            <p className="text-xs text-gray-500">Status: {event.status}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <Calendar size={16} className="mt-0.5 text-gray-400" />
            <div>
              <p>{startLabel}</p>
              <p className="text-xs text-gray-500">Até {endLabel}</p>
            </div>
          </div>
          {event.location && (
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 text-gray-400" />
              <span>{event.location}</span>
            </div>
          )}
          {event.meeting_url && (
            <div className="flex items-start gap-2">
              <LinkIcon size={16} className="mt-0.5 text-gray-400" />
              <a href={event.meeting_url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                Link do evento
              </a>
            </div>
          )}
        </div>

        {event.description && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-600">
            {event.description}
          </div>
        )}

        {!clinicView && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users size={16} /> Clínicas participantes
            </div>
            <div className="space-y-2">
              {attendees.map((att) => (
                <div key={`${att.event_id}-${att.clinic_id}`} className="flex items-center justify-between text-sm text-gray-600">
                  <span>{att.clinic?.name || att.clinic_id}</span>
                  <span className="px-2 py-1 rounded-full text-xs bg-gray-100">{att.confirm_status}</span>
                </div>
              ))}
              {attendees.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma clínica vinculada.</p>
              )}
            </div>
          </div>
        )}

        {!clinicView && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Pedidos de reagendamento</h4>
            {changeRequests.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum pedido registrado até o momento.</p>
            ) : (
              <div className="space-y-2">
                {changeRequests.map((req) => (
                  <div key={req.id} className="border border-gray-100 rounded-lg p-3 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700">{req.reason}</p>
                    {req.suggested_start_at && (
                      <p>Início sugerido: {new Date(req.suggested_start_at).toLocaleString('pt-BR')}</p>
                    )}
                    {req.suggested_end_at && (
                      <p>Fim sugerido: {new Date(req.suggested_end_at).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {clinicView ? (
            <>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={onRequestReschedule}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600"
              >
                Solicitar reagendamento
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm"
              >
                Cancelar evento
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDrawer;
