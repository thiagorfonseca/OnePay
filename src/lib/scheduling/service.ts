import { supabase } from '../../../lib/supabase';
import type {
  ScheduleEvent,
  ScheduleEventAttendee,
  ScheduleEventWithAttendees,
  ScheduleEventForClinic,
  ScheduleChangeRequest,
  SuggestedSlot,
  WorkingHoursRule,
  ScheduleStatus,
} from './types';

const getWebhookUrl = () => {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
  return (env.VITE_SCHEDULING_WEBHOOK_URL || env.SCHEDULING_WEBHOOK_URL || '').trim();
};

const fireWebhook = async (type: string, payload: Record<string, any>) => {
  const url = getWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // silencioso para MVP
  }
};

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const sb = supabase as any;

const hasOverlap = async (params: {
  consultantId: string;
  startAt: string;
  endAt: string;
  ignoreEventId?: string;
}) => {
  let query = sb
    .from('schedule_events')
    .select('id')
    .eq('consultant_id', params.consultantId)
    .neq('status', 'cancelled')
    .lt('start_at', params.endAt)
    .gt('end_at', params.startAt);

  if (params.ignoreEventId) {
    query = query.neq('id', params.ignoreEventId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
};

export const listEventsForAdmin = async (params: {
  consultantId?: string | null;
  rangeStart?: Date | string;
  rangeEnd?: Date | string;
}) => {
  let query = sb
    .from('schedule_events')
    .select('*, schedule_event_attendees (clinic_id, confirm_status, confirmed_by, confirmed_at, clinics (id, name))')
    .order('start_at', { ascending: true });

  if (params.consultantId) {
    query = query.eq('consultant_id', params.consultantId);
  }
  if (params.rangeStart) query = query.gte('start_at', toIso(params.rangeStart));
  if (params.rangeEnd) query = query.lte('end_at', toIso(params.rangeEnd));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...(row as ScheduleEvent),
    attendees: (row.schedule_event_attendees || []).map((att: any) => ({
      event_id: row.id,
      clinic_id: att.clinic_id,
      confirm_status: att.confirm_status,
      confirmed_by: att.confirmed_by,
      confirmed_at: att.confirmed_at,
      clinic: att.clinics ? { id: att.clinics.id, name: att.clinics.name } : undefined,
    })) as ScheduleEventAttendee[],
  })) as ScheduleEventWithAttendees[];
};

export const listEventsForClinic = async (params: {
  clinicId: string;
  rangeStart?: Date | string;
  rangeEnd?: Date | string;
}) => {
  let query = sb
    .from('schedule_event_attendees')
    .select('confirm_status, confirmed_at, schedule_events (*)')
    .eq('clinic_id', params.clinicId);

  if (params.rangeStart) query = query.gte('schedule_events.start_at', toIso(params.rangeStart));
  if (params.rangeEnd) query = query.lte('schedule_events.end_at', toIso(params.rangeEnd));

  const { data, error } = await query;
  if (error) throw error;
  return (data || [])
    .filter((row: any) => row.schedule_events)
    .map((row: any) => ({
      ...(row.schedule_events as ScheduleEvent),
      confirm_status: row.confirm_status,
      confirmed_at: row.confirmed_at,
    })) as ScheduleEventForClinic[];
};

export const listChangeRequests = async (eventId: string) => {
  const { data, error } = await sb
    .from('schedule_change_requests')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ScheduleChangeRequest[];
};

export const createEvent = async (payload: {
  event: Omit<ScheduleEvent, 'id' | 'created_at' | 'updated_at'>;
  clinicIds: string[];
}) => {
  const { event, clinicIds } = payload;
  if (
    await hasOverlap({
      consultantId: event.consultant_id,
      startAt: event.start_at,
      endAt: event.end_at,
    })
  ) {
    throw new Error('Conflito de horário com outro agendamento.');
  }
  const { data, error } = await sb
    .from('schedule_events')
    .insert({
      consultant_id: event.consultant_id,
      title: event.title,
      description: event.description ?? null,
      start_at: event.start_at,
      end_at: event.end_at,
      timezone: event.timezone,
      location: event.location ?? null,
      meeting_url: event.meeting_url ?? null,
      status: event.status,
      recurrence_rule: event.recurrence_rule ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  const createdEvent = data as ScheduleEvent;

  if (clinicIds.length) {
    const attendeesPayload = clinicIds.map((clinicId) => ({
      event_id: createdEvent.id,
      clinic_id: clinicId,
    }));
    const { error: attendeeError } = await sb.from('schedule_event_attendees').insert(attendeesPayload);
    if (attendeeError) throw attendeeError;

    const notificationsPayload = clinicIds.map((clinicId) => ({
      target: 'clinic',
      clinic_id: clinicId,
      type: 'event_created',
      payload: { event_id: createdEvent.id, clinic_id: clinicId },
    }));
    await sb.from('notifications').insert(notificationsPayload);
  }

  await fireWebhook('event_created', { event_id: createdEvent.id, clinic_ids: clinicIds });
  return createdEvent;
};

export const updateEvent = async (payload: {
  eventId: string;
  updates: Partial<ScheduleEvent>;
  clinicIds?: string[];
  forceStatus?: ScheduleStatus;
}) => {
  const { eventId, updates, clinicIds, forceStatus } = payload;
  if (updates.start_at || updates.end_at || updates.consultant_id) {
    const { data: current, error: currentError } = await sb
      .from('schedule_events')
      .select('consultant_id, start_at, end_at')
      .eq('id', eventId)
      .single();
    if (currentError) throw currentError;
    const consultantId = updates.consultant_id ?? current.consultant_id;
    const startAt = updates.start_at ?? current.start_at;
    const endAt = updates.end_at ?? current.end_at;
    if (
      await hasOverlap({
        consultantId,
        startAt,
        endAt,
        ignoreEventId: eventId,
      })
    ) {
      throw new Error('Conflito de horário com outro agendamento.');
    }
  }
  const nextUpdates = { ...updates };
  if (forceStatus) nextUpdates.status = forceStatus;
  const { data, error } = await sb
    .from('schedule_events')
    .update(nextUpdates)
    .eq('id', eventId)
    .select('*')
    .single();
  if (error) throw error;

  if (clinicIds) {
    await sb.from('schedule_event_attendees').delete().eq('event_id', eventId);
    if (clinicIds.length) {
      const attendeesPayload = clinicIds.map((clinicId) => ({
        event_id: eventId,
        clinic_id: clinicId,
      }));
      const { error: attendeeError } = await sb.from('schedule_event_attendees').insert(attendeesPayload);
      if (attendeeError) throw attendeeError;
    }
  }

  await fireWebhook('event_updated', { event_id: eventId });
  return data as ScheduleEvent;
};

export const cancelEvent = async (eventId: string, clinicIds: string[]) => {
  const { error } = await sb
    .from('schedule_events')
    .update({ status: 'cancelled' })
    .eq('id', eventId);
  if (error) throw error;
  if (clinicIds.length) {
    const notificationsPayload = clinicIds.map((clinicId) => ({
      target: 'clinic',
      clinic_id: clinicId,
      type: 'event_cancelled',
      payload: { event_id: eventId, clinic_id: clinicId },
    }));
    await sb.from('notifications').insert(notificationsPayload);
  }
  await fireWebhook('event_cancelled', { event_id: eventId });
};

export const confirmEventAttendance = async (eventId: string, clinicId: string) => {
  const { error } = await sb.rpc('confirm_schedule_event', {
    p_event_id: eventId,
    p_clinic_id: clinicId,
  });
  if (error) throw error;
  await fireWebhook('event_confirmed', { event_id: eventId, clinic_id: clinicId });
};

export const requestReschedule = async (payload: {
  eventId: string;
  clinicId: string;
  reason: string;
  suggestedStartAt?: string | null;
  suggestedEndAt?: string | null;
}) => {
  const { error } = await sb.rpc('request_schedule_reschedule', {
    p_event_id: payload.eventId,
    p_clinic_id: payload.clinicId,
    p_reason: payload.reason,
    p_suggested_start_at: payload.suggestedStartAt ?? null,
    p_suggested_end_at: payload.suggestedEndAt ?? null,
  });
  if (error) throw error;
  await fireWebhook('reschedule_requested', {
    event_id: payload.eventId,
    clinic_id: payload.clinicId,
    reason: payload.reason,
    suggested_start_at: payload.suggestedStartAt,
    suggested_end_at: payload.suggestedEndAt,
  });
};

export const suggestTimeSlots = async (params: {
  consultantId: string;
  durationMinutes: number;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  workingHours: WorkingHoursRule;
  bufferMinutes: number;
  slotStepMinutes?: number;
}): Promise<SuggestedSlot[]> => {
  const slotStep = params.slotStepMinutes ?? 30;
  const { data, error } = await sb
    .from('schedule_events')
    .select('start_at, end_at, status')
    .eq('consultant_id', params.consultantId)
    .neq('status', 'cancelled')
    .gte('start_at', params.dateRangeStart.toISOString())
    .lte('end_at', params.dateRangeEnd.toISOString());
  if (error) throw error;

  const busyRanges: Array<{ start: Date; end: Date }> = (data || []).map((row: any) => {
    const start = new Date(row.start_at);
    const end = new Date(row.end_at);
    return {
      start: new Date(start.getTime() - params.bufferMinutes * 60000),
      end: new Date(end.getTime() + params.bufferMinutes * 60000),
    };
  });

  const slots: SuggestedSlot[] = [];
  const cursor = new Date(params.dateRangeStart);
  const endDate = new Date(params.dateRangeEnd);

  const parseTime = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return { h: h || 0, m: m || 0 };
  };

  const workStart = parseTime(params.workingHours.start);
  const workEnd = parseTime(params.workingHours.end);

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getDay();
    if (params.workingHours.days.includes(dayOfWeek)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(workStart.h, workStart.m, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(workEnd.h, workEnd.m, 0, 0);

      for (let t = new Date(dayStart); t <= dayEnd; t = new Date(t.getTime() + slotStep * 60000)) {
        const slotStart = new Date(t);
        const slotEnd = new Date(slotStart.getTime() + params.durationMinutes * 60000);
        if (slotEnd > dayEnd) break;
        const overlaps = busyRanges.some((busy) => slotStart < busy.end && slotEnd > busy.start);
        if (!overlaps) {
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
        if (slots.length >= 10) return slots;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
};
