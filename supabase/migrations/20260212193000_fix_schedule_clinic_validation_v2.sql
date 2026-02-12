create or replace function public.confirm_schedule_event(p_event_id uuid, p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not (
    public.is_system_admin()
    or public.is_clinic_member(p_clinic_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.clinic_id = p_clinic_id
    )
    or exists (
      select 1
      from public.clinic_users cu
      where cu.clinic_id = p_clinic_id
        and cu.user_id = auth.uid()
        and cu.ativo = true
    )
  ) then
    raise exception 'Clínica inválida';
  end if;

  update public.schedule_event_attendees
    set confirm_status = 'confirmed',
        confirmed_by = auth.uid(),
        confirmed_at = now()
  where event_id = p_event_id
    and clinic_id = p_clinic_id;

  if not found then
    raise exception 'Agendamento não encontrado';
  end if;

  if not exists (
    select 1
    from public.schedule_event_attendees sea
    where sea.event_id = p_event_id
      and sea.confirm_status <> 'confirmed'
  ) then
    update public.schedule_events
      set status = 'confirmed'
    where id = p_event_id
      and status <> 'cancelled';
  end if;

  insert into public.notifications (target, clinic_id, type, payload)
  values (
    'one_doctor',
    p_clinic_id,
    'event_confirmed',
    jsonb_build_object('event_id', p_event_id, 'clinic_id', p_clinic_id)
  );
end;
$$;

grant execute on function public.confirm_schedule_event(uuid, uuid) to authenticated;

create or replace function public.request_schedule_reschedule(
  p_event_id uuid,
  p_clinic_id uuid,
  p_reason text,
  p_suggested_start_at timestamptz,
  p_suggested_end_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not (
    public.is_system_admin()
    or public.is_clinic_member(p_clinic_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.clinic_id = p_clinic_id
    )
    or exists (
      select 1
      from public.clinic_users cu
      where cu.clinic_id = p_clinic_id
        and cu.user_id = auth.uid()
        and cu.ativo = true
    )
  ) then
    raise exception 'Clínica inválida';
  end if;

  if not exists (
    select 1
    from public.schedule_event_attendees sea
    where sea.event_id = p_event_id
      and sea.clinic_id = p_clinic_id
  ) then
    raise exception 'Agendamento não encontrado';
  end if;

  insert into public.schedule_change_requests (
    event_id,
    clinic_id,
    requested_by,
    reason,
    suggested_start_at,
    suggested_end_at
  )
  values (
    p_event_id,
    p_clinic_id,
    auth.uid(),
    p_reason,
    p_suggested_start_at,
    p_suggested_end_at
  );

  update public.schedule_events
    set status = 'reschedule_requested'
  where id = p_event_id
    and status <> 'cancelled';

  insert into public.notifications (target, clinic_id, type, payload)
  values (
    'one_doctor',
    p_clinic_id,
    'reschedule_requested',
    jsonb_build_object(
      'event_id', p_event_id,
      'clinic_id', p_clinic_id,
      'reason', p_reason,
      'suggested_start_at', p_suggested_start_at,
      'suggested_end_at', p_suggested_end_at
    )
  );
end;
$$;

grant execute on function public.request_schedule_reschedule(uuid, uuid, text, timestamptz, timestamptz) to authenticated;
