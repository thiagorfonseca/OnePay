import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';
import { Calendar, Clock } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { ToastStack } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import EventDrawer from '../components/scheduling/EventDrawer';
import RescheduleModal from '../components/scheduling/RescheduleModal';
import {
  confirmEventAttendance,
  listEventsForClinic,
  requestReschedule,
  type ScheduleEventForClinic,
} from '../src/lib/scheduling';

const toLocalLabel = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const formatMonthYear = (value: Date) => {
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const ClinicAgenda: React.FC = () => {
  const { effectiveClinicId: clinicId, clinic } = useAuth();
  const calendarRef = useRef<FullCalendar | null>(null);
  const { toasts, push, dismiss } = useToast();
  const [view, setView] = useState<'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'>('timeGridWeek');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ScheduleEventForClinic[]>([]);
  const [calendarLabel, setCalendarLabel] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventForClinic | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    reason: '',
    suggestedStart: '',
    suggestedEnd: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = async (start?: Date, end?: Date) => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await listEventsForClinic({ clinicId, rangeStart: start, rangeEnd: end });
      setEvents(data);
    } catch (err: any) {
      push({ title: 'Erro ao carregar agenda', description: err?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!range) return;
    fetchEvents(range.start, range.end);
  }, [range?.start?.toISOString(), range?.end?.toISOString()]);

  const calendarEvents = useMemo(() => {
    return events.map((event) => {
      const tone =
        event.status === 'cancelled'
          ? '#e5e7eb'
          : event.confirm_status === 'confirmed'
            ? '#d1fae5'
            : event.status === 'reschedule_requested'
              ? '#fef3c7'
              : '#dbeafe';
      return {
        id: event.id,
        title: event.title,
        start: event.start_at,
        end: event.end_at,
        backgroundColor: tone,
        borderColor: tone,
        textColor: '#111827',
      };
    });
  }, [events]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((event) => new Date(event.start_at) >= now && event.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 6);
  }, [events]);

  const handleEventClick = (arg: EventClickArg) => {
    const event = events.find((item) => item.id === arg.event.id);
    if (!event) return;
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedEvent || !clinicId) return;
    try {
      await confirmEventAttendance(selectedEvent.id, clinicId);
      push({ title: 'Agendamento confirmado.', variant: 'success' });
      setDrawerOpen(false);
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível confirmar.', description: err?.message, variant: 'error' });
    }
  };

  const handleRequestReschedule = async () => {
    if (!selectedEvent || !clinicId) return;
    if (!rescheduleForm.reason.trim()) {
      push({ title: 'Informe o motivo do reagendamento.', variant: 'info' });
      return;
    }
    setSubmitting(true);
    try {
      await requestReschedule({
        eventId: selectedEvent.id,
        clinicId,
        reason: rescheduleForm.reason.trim(),
        suggestedStartAt: rescheduleForm.suggestedStart
          ? new Date(rescheduleForm.suggestedStart).toISOString()
          : null,
        suggestedEndAt: rescheduleForm.suggestedEnd
          ? new Date(rescheduleForm.suggestedEnd).toISOString()
          : null,
      });
      push({ title: 'Solicitação enviada.', variant: 'success' });
      setRescheduleOpen(false);
      setDrawerOpen(false);
      setRescheduleForm({ reason: '', suggestedStart: '', suggestedEnd: '' });
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível solicitar reagendamento.', description: err?.message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDatesSet = (info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCalendarLabel(formatMonthYear(info.view.currentStart));
  };

  const switchView = (next: typeof view) => {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  };

  if (!clinicId) {
    return <div className="text-sm text-gray-500">Selecione uma clínica para visualizar a agenda.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastStack items={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agendamento Inteligente</h1>
          <p className="text-sm text-gray-500">{clinic?.name ? `Clínica ${clinic.name}` : 'Agenda da clínica'}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().today()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().prev()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().next()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => switchView('timeGridDay')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'timeGridDay' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Dia
          </button>
          <button
            type="button"
            onClick={() => switchView('timeGridWeek')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'timeGridWeek' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => switchView('dayGridMonth')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'dayGridMonth' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Mês
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar size={16} /> {loading ? 'Carregando agenda...' : 'Agenda da clínica'}
          </div>
          <div className="mb-3 text-lg font-semibold text-gray-800">{calendarLabel || '—'}</div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            height="auto"
            selectable={false}
            editable={false}
            events={calendarEvents}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            headerToolbar={false}
            dayMaxEventRows
            nowIndicator
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Clock size={16} /> Próximos agendamentos
          </div>
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-500">Nenhum agendamento futuro encontrado.</p>
          )}
          <div className="space-y-3">
            {upcoming.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedEvent(event);
                  setDrawerOpen(true);
                }}
                className="w-full text-left border border-gray-100 rounded-xl px-3 py-3 hover:border-brand-200 hover:bg-brand-50 transition"
              >
                <div className="text-sm font-semibold text-gray-800">{event.title}</div>
                <div className="text-xs text-gray-500">{toLocalLabel(event.start_at)} • {toLocalLabel(event.end_at)}</div>
                <div className="text-xs mt-1 text-gray-400">Status: {event.confirm_status}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={selectedEvent}
        clinicView
        onConfirm={handleConfirm}
        onRequestReschedule={() => setRescheduleOpen(true)}
      />

      <RescheduleModal
        open={rescheduleOpen}
        reason={rescheduleForm.reason}
        suggestedStart={rescheduleForm.suggestedStart}
        suggestedEnd={rescheduleForm.suggestedEnd}
        submitting={submitting}
        onChange={(patch) => setRescheduleForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleRequestReschedule}
        onClose={() => setRescheduleOpen(false)}
      />
    </div>
  );
};

export default ClinicAgenda;
