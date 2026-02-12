import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import EventModal, { EventFormState } from '../components/scheduling/EventModal';
import EventDrawer from '../components/scheduling/EventDrawer';
import { ToastStack } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useModalControls } from '../hooks/useModalControls';
import {
  cancelEvent,
  createEvent,
  listChangeRequests,
  listEventsForAdmin,
  suggestTimeSlots,
  updateEvent,
  type ScheduleEventWithAttendees,
  type SuggestedSlot,
} from '../src/lib/scheduling';
import { supabase } from '../lib/supabase';

const emptyForm: EventFormState = {
  title: '',
  description: '',
  start: '',
  end: '',
  timezone: 'America/Sao_Paulo',
  location: '',
  meeting_url: '',
};

const toLocalInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const formatMonthYear = (value: Date) => {
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const AdminAgenda: React.FC = () => {
  const { user, isSystemAdmin } = useAuth();
  const calendarRef = useRef<FullCalendar | null>(null);
  const { toasts, push, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ScheduleEventWithAttendees[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [view, setView] = useState<'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'>('dayGridMonth');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [calendarLabel, setCalendarLabel] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventWithAttendees | null>(null);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);

  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const lastRescheduleCount = useRef(0);
  const [pendingRescheduleRequest, setPendingRescheduleRequest] = useState<any | null>(null);

  const sb = supabase as any;

  const rescheduleModalControls = useModalControls({
    isOpen: rescheduleModalOpen,
    onClose: () => setRescheduleModalOpen(false),
  });

  useEffect(() => {
    if (!isSystemAdmin) return;
    const loadClinics = async () => {
      const { data } = await sb.from('clinics').select('id, name').order('name', { ascending: true });
      setClinics((data || []).map((row: any) => ({ id: row.id, name: row.name })));
    };
    loadClinics();
  }, [isSystemAdmin]);

  const fetchEvents = async (start?: Date, end?: Date) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await listEventsForAdmin({
        consultantId: user.id,
        rangeStart: start,
        rangeEnd: end,
      });
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

  const loadRescheduleRequests = useCallback(async () => {
    if (!isSystemAdmin) return;
    setRescheduleLoading(true);
    const { data, error } = await sb
      .from('schedule_change_requests')
      .select('id, event_id, reason, suggested_start_at, suggested_end_at, status, created_at, clinic_id, schedule_events (id, title, start_at, end_at, location, meeting_url, description, timezone), clinics (id, name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (!error) {
      const next = data || [];
      setRescheduleRequests(next);
      if (next.length > 0 && next.length !== lastRescheduleCount.current) {
        setRescheduleModalOpen(true);
      }
      lastRescheduleCount.current = next.length;
    }
    setRescheduleLoading(false);
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadRescheduleRequests();
    };
    run();
    const interval = window.setInterval(run, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isSystemAdmin, loadRescheduleRequests]);

  const calendarEvents = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start_at,
      end: event.end_at,
      backgroundColor:
        event.status === 'cancelled'
          ? '#e5e7eb'
          : event.status === 'reschedule_requested'
            ? '#fef3c7'
            : event.status === 'confirmed'
              ? '#d1fae5'
              : '#dbeafe',
      borderColor: event.status === 'cancelled' ? '#e5e7eb' : '#93c5fd',
      textColor: '#111827',
    }));
  }, [events]);

  const openCreate = (start?: Date, end?: Date) => {
    setModalMode('create');
    setForm({
      ...emptyForm,
      start: start ? toLocalInput(start) : '',
      end: end ? toLocalInput(end) : '',
    });
    setSelectedClinics([]);
    setSuggestions([]);
    setPendingRescheduleRequest(null);
    setModalOpen(true);
  };

  const openEdit = (event: ScheduleEventWithAttendees) => {
    setModalMode('edit');
    setForm({
      title: event.title,
      description: event.description || '',
      start: toLocalInput(event.start_at),
      end: toLocalInput(event.end_at),
      timezone: event.timezone || 'America/Sao_Paulo',
      location: event.location || '',
      meeting_url: event.meeting_url || '',
    });
    setSelectedClinics(event.attendees.map((att) => att.clinic_id));
    setSuggestions([]);
    setPendingRescheduleRequest(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.title.trim() || !form.start || !form.end) {
      push({ title: 'Preencha título, início e fim.', variant: 'error' });
      return;
    }
    if (selectedClinics.length === 0) {
      push({ title: 'Selecione ao menos uma clínica.', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const eventPayload = {
        consultant_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_at: new Date(form.start).toISOString(),
        end_at: new Date(form.end).toISOString(),
        timezone: form.timezone || 'America/Sao_Paulo',
        location: form.location.trim() || null,
        meeting_url: form.meeting_url.trim() || null,
        status: modalMode === 'create' ? 'pending_confirmation' : (selectedEvent?.status || 'pending_confirmation'),
        recurrence_rule: null,
      } as const;

      if (modalMode === 'create') {
        await createEvent({ event: eventPayload, clinicIds: selectedClinics });
        push({ title: 'Agendamento criado.', variant: 'success' });
      } else if (selectedEvent) {
        const hasTimeChanged =
          eventPayload.start_at !== selectedEvent.start_at || eventPayload.end_at !== selectedEvent.end_at;
        const nextStatus =
          selectedEvent.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : selectedEvent.status;
        await updateEvent({
          eventId: selectedEvent.id,
          updates: {
            title: eventPayload.title,
            description: eventPayload.description,
            start_at: eventPayload.start_at,
            end_at: eventPayload.end_at,
            timezone: eventPayload.timezone,
            location: eventPayload.location,
            meeting_url: eventPayload.meeting_url,
            status: nextStatus,
          },
          clinicIds: selectedClinics,
          forceStatus: nextStatus,
        });

        if (pendingRescheduleRequest && selectedClinics.length) {
          await sb
            .from('schedule_change_requests')
            .update({
              status: 'accepted',
              handled_by: user.id,
              handled_at: new Date().toISOString(),
            })
            .eq('id', pendingRescheduleRequest.id);

          const notificationsPayload = selectedClinics.map((clinicId) => ({
            target: 'clinic',
            clinic_id: clinicId,
            type: 'event_rescheduled',
            payload: {
              event_id: selectedEvent.id,
              clinic_id: clinicId,
              start_at: eventPayload.start_at,
              end_at: eventPayload.end_at,
              reason: pendingRescheduleRequest.reason,
            },
          }));
          await sb.from('notifications').insert(notificationsPayload);
          setPendingRescheduleRequest(null);
          await loadRescheduleRequests();
        }

        push({ title: 'Agendamento atualizado.', variant: 'success' });
      }
      setModalOpen(false);
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      const isOverlap =
        err?.code === '23P01' ||
        (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap')) ||
        (typeof err?.message === 'string' && err.message.includes('Conflito de horário'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Erro ao salvar agendamento.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
      if (isOverlap) {
        await handleSuggest();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async () => {
    if (!user?.id) return;
    if (!form.start || !form.end) {
      push({ title: 'Defina início e fim para sugerir horários.', variant: 'info' });
      return;
    }
    const start = new Date(form.start);
    const end = new Date(form.end);
    const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    setSuggesting(true);
    try {
      const slots = await suggestTimeSlots({
        consultantId: user.id,
        durationMinutes,
        dateRangeStart: start,
        dateRangeEnd: new Date(start.getTime() + 14 * 24 * 60 * 60000),
        workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
        bufferMinutes: 15,
      });
      setSuggestions(slots);
    } catch (err: any) {
      push({ title: 'Não foi possível sugerir horários.', description: err?.message, variant: 'error' });
    } finally {
      setSuggesting(false);
    }
  };

  const handleEventClick = async (arg: EventClickArg) => {
    const event = events.find((e) => e.id === arg.event.id);
    if (!event) return;
    setSelectedEvent(event);
    setDrawerOpen(true);
    try {
      const requests = await listChangeRequests(event.id);
      setChangeRequests(requests);
    } catch {
      setChangeRequests([]);
    }
  };

  const handleCancel = async () => {
    if (!selectedEvent) return;
    if (!confirm('Cancelar este agendamento?')) return;
    try {
      await cancelEvent(selectedEvent.id, selectedEvent.attendees.map((a) => a.clinic_id));
      push({ title: 'Agendamento cancelado.', variant: 'success' });
      setDrawerOpen(false);
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Erro ao cancelar agendamento.', description: err?.message, variant: 'error' });
    }
  };

  const handleDatesSet = (info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCalendarLabel(formatMonthYear(info.view.currentStart));
  };

  const handleSelect = (info: DateSelectArg) => {
    openCreate(info.start, info.end);
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const schedule = events.find((event) => event.id === info.event.id);
    if (!schedule || !info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    try {
      const startAt = info.event.start.toISOString();
      const endAt = info.event.end.toISOString();
      const hasTimeChanged = startAt !== schedule.start_at || endAt !== schedule.end_at;
      const nextStatus =
        schedule.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : schedule.status;
      await updateEvent({
        eventId: schedule.id,
        updates: { start_at: startAt, end_at: endAt },
        forceStatus: nextStatus,
      });
      push({ title: 'Horário atualizado.', variant: 'success' });
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      info.revert();
      const isOverlap =
        err?.code === '23P01' || (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Não foi possível mover o agendamento.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
    }
  };

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const schedule = events.find((event) => event.id === info.event.id);
    if (!schedule || !info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    try {
      const startAt = info.event.start.toISOString();
      const endAt = info.event.end.toISOString();
      const hasTimeChanged = startAt !== schedule.start_at || endAt !== schedule.end_at;
      const nextStatus =
        schedule.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : schedule.status;
      await updateEvent({
        eventId: schedule.id,
        updates: { start_at: startAt, end_at: endAt },
        forceStatus: nextStatus,
      });
      push({ title: 'Duração atualizada.', variant: 'success' });
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      info.revert();
      const isOverlap =
        err?.code === '23P01' || (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Não foi possível redimensionar.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
    }
  };

  const switchView = (next: typeof view) => {
    setView(next);
    const api = calendarRef.current?.getApi();
    api?.changeView(next);
  };

  const openRescheduleRequest = async (req: any) => {
    const eventFromState = events.find((event) => event.id === req.event_id);
    const fallbackEvent = req.schedule_events
      ? { ...req.schedule_events, attendees: [] }
      : null;
    const targetEvent = eventFromState || fallbackEvent;
    if (!targetEvent) {
      push({ title: 'Evento não encontrado para reagendar.', variant: 'error' });
      return;
    }
    const clinicIds =
      eventFromState?.attendees?.map((att) => att.clinic_id) || [];
    if (!clinicIds.length) {
      const { data } = await sb
        .from('schedule_event_attendees')
        .select('clinic_id')
        .eq('event_id', targetEvent.id);
      setSelectedClinics((data || []).map((row: any) => row.clinic_id));
    } else {
      setSelectedClinics(clinicIds);
    }
    setSelectedEvent(targetEvent as ScheduleEventWithAttendees);
    setModalMode('edit');
    setForm({
      title: targetEvent.title,
      description: targetEvent.description || '',
      start: req.suggested_start_at ? toLocalInput(req.suggested_start_at) : toLocalInput(targetEvent.start_at),
      end: req.suggested_end_at ? toLocalInput(req.suggested_end_at) : toLocalInput(targetEvent.end_at),
      timezone: targetEvent.timezone || 'America/Sao_Paulo',
      location: targetEvent.location || '',
      meeting_url: targetEvent.meeting_url || '',
    });
    setPendingRescheduleRequest(req);
    setRescheduleModalOpen(false);
    setModalOpen(true);
  };

  const rejectRescheduleRequest = async (req: any) => {
    if (!user?.id) return;
    try {
      await sb
        .from('schedule_change_requests')
        .update({
          status: 'rejected',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      const { data: remaining } = await sb
        .from('schedule_change_requests')
        .select('id')
        .eq('event_id', req.event_id)
        .eq('status', 'open')
        .limit(1);

      if (!remaining?.length) {
        const { data: attendees } = await sb
          .from('schedule_event_attendees')
          .select('confirm_status')
          .eq('event_id', req.event_id);
        const hasPending = (attendees || []).some((row: any) => row.confirm_status !== 'confirmed');
        await sb
          .from('schedule_events')
          .update({ status: hasPending ? 'pending_confirmation' : 'confirmed' })
          .eq('id', req.event_id)
          .neq('status', 'cancelled');
      }

      await sb.from('notifications').insert([
        {
          target: 'clinic',
          clinic_id: req.clinic_id,
          type: 'reschedule_rejected',
          payload: { event_id: req.event_id, clinic_id: req.clinic_id, reason: req.reason },
        },
      ]);

      push({ title: 'Solicitação marcada como não reagendada.', variant: 'success' });
      await loadRescheduleRequests();
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível atualizar a solicitação.', description: err?.message, variant: 'error' });
    }
  };

  if (!isSystemAdmin) {
    return <div className="text-sm text-gray-500">Acesso restrito aos consultores One Doctor.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastStack items={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agendamento Inteligente</h1>
          <p className="text-sm text-gray-500">Admin • Agenda do consultor</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {rescheduleRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setRescheduleModalOpen(true)}
              className="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white flex items-center gap-2 shadow-sm hover:bg-amber-700"
            >
              Solicitações ({rescheduleRequests.length})
            </button>
          )}
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
          <button
            type="button"
            onClick={() => openCreate()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white flex items-center gap-2"
          >
            <Plus size={16} /> Criar agendamento
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 text-sm text-gray-500 mb-1">
          <Calendar size={16} /> {loading ? 'Carregando agenda...' : 'Agenda do consultor'}
        </div>
        <div className="mb-3 text-lg font-semibold text-gray-800">{calendarLabel || '—'}</div>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          height="auto"
          selectable
          editable
          eventResizableFromStart
          events={calendarEvents}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          datesSet={handleDatesSet}
          headerToolbar={false}
          dayMaxEventRows
          nowIndicator
        />
      </div>

      <EventModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        clinics={clinics}
        selectedClinics={selectedClinics}
        suggestions={suggestions}
        saving={saving}
        suggesting={suggesting}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onToggleClinic={(id) =>
          setSelectedClinics((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
        }
        onSave={handleSave}
        onSuggest={handleSuggest}
        onClose={() => setModalOpen(false)}
      />

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={selectedEvent}
        attendees={selectedEvent?.attendees || []}
        changeRequests={changeRequests}
        onEdit={() => {
          if (selectedEvent) {
            openEdit(selectedEvent);
            setDrawerOpen(false);
          }
        }}
        onCancel={handleCancel}
      />

      {rescheduleModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8"
          onClick={rescheduleModalControls.onBackdropClick}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Solicitações de reagendamento</h3>
                <p className="text-sm text-gray-500">Acompanhe os pedidos das clínicas.</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {rescheduleLoading && (
              <p className="text-sm text-gray-500">Carregando solicitações...</p>
            )}
            {!rescheduleLoading && rescheduleRequests.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma solicitação aberta.</p>
            )}

            {!rescheduleLoading && rescheduleRequests.length > 0 && (
              <div className="space-y-3">
                {rescheduleRequests.map((req) => (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-800">
                        Clínica: {req.clinics?.name || req.clinic_id}
                      </div>
                      <div className="text-xs text-gray-400">{formatDateTime(req.created_at)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
                      <div>Início sugerido: {formatDateTime(req.suggested_start_at)}</div>
                      <div>Fim sugerido: {formatDateTime(req.suggested_end_at)}</div>
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{req.reason}</div>
                    {req.schedule_events && (
                      <div className="mt-2 text-xs text-gray-500">
                        Evento: {req.schedule_events.title} • {formatDateTime(req.schedule_events.start_at)} → {formatDateTime(req.schedule_events.end_at)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openRescheduleRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                      >
                        Reagendar
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectRescheduleRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Não reagendado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgenda;
