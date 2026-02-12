create extension if not exists btree_gist;

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  location text null,
  meeting_url text null,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'cancelled', 'reschedule_requested', 'rescheduled')),
  recurrence_rule text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_at > start_at)
);

create index if not exists schedule_events_consultant_start_idx
  on public.schedule_events(consultant_id, start_at);

create index if not exists schedule_events_status_idx
  on public.schedule_events(status);

alter table public.schedule_events enable row level security;

drop trigger if exists schedule_events_set_updated_at on public.schedule_events;
create trigger schedule_events_set_updated_at
before update on public.schedule_events
for each row execute procedure public.handle_updated_at();

alter table public.schedule_events
  add constraint schedule_events_no_overlap
  exclude using gist (
    consultant_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status <> 'cancelled');

create table if not exists public.schedule_event_attendees (
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  confirm_status text not null default 'pending'
    check (confirm_status in ('pending', 'confirmed', 'declined')),
  confirmed_by uuid null references auth.users(id),
  confirmed_at timestamptz null,
  primary key (event_id, clinic_id)
);

create index if not exists schedule_event_attendees_clinic_idx
  on public.schedule_event_attendees(clinic_id);

create table if not exists public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  reason text not null,
  suggested_start_at timestamptz null,
  suggested_end_at timestamptz null,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'rejected', 'cancelled')),
  handled_by uuid null references auth.users(id),
  handled_at timestamptz null,
  created_at timestamptz default now(),
  check (
    suggested_start_at is null
    or suggested_end_at is null
    or suggested_end_at > suggested_start_at
  )
);

create index if not exists schedule_change_requests_event_idx
  on public.schedule_change_requests(event_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('one_doctor', 'clinic')),
  clinic_id uuid null references public.clinics(id) on delete cascade,
  to_user_id uuid null references auth.users(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz default now()
);

create index if not exists notifications_target_idx
  on public.notifications(target, created_at desc);

create index if not exists notifications_clinic_idx
  on public.notifications(clinic_id);

create or replace function public.is_system_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  );
$$;

drop policy if exists "schedule_events_admin_all" on public.schedule_events;
create policy "schedule_events_admin_all"
  on public.schedule_events
  for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "schedule_events_clinic_select" on public.schedule_events;
create policy "schedule_events_clinic_select"
  on public.schedule_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_event_attendees sea
      where sea.event_id = schedule_events.id
        and public.is_clinic_member(sea.clinic_id)
    )
  );

alter table public.schedule_event_attendees enable row level security;

drop policy if exists "schedule_event_attendees_admin_all" on public.schedule_event_attendees;
create policy "schedule_event_attendees_admin_all"
  on public.schedule_event_attendees
  for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "schedule_event_attendees_clinic_select" on public.schedule_event_attendees;
create policy "schedule_event_attendees_clinic_select"
  on public.schedule_event_attendees
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

alter table public.schedule_change_requests enable row level security;

drop policy if exists "schedule_change_requests_admin_all" on public.schedule_change_requests;
create policy "schedule_change_requests_admin_all"
  on public.schedule_change_requests
  for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "schedule_change_requests_clinic_select" on public.schedule_change_requests;
create policy "schedule_change_requests_clinic_select"
  on public.schedule_change_requests
  for select
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and exists (
      select 1
      from public.schedule_event_attendees sea
      where sea.event_id = schedule_change_requests.event_id
        and sea.clinic_id = schedule_change_requests.clinic_id
    )
  );

drop policy if exists "schedule_change_requests_clinic_insert" on public.schedule_change_requests;
create policy "schedule_change_requests_clinic_insert"
  on public.schedule_change_requests
  for insert
  to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and exists (
      select 1
      from public.schedule_event_attendees sea
      where sea.event_id = schedule_change_requests.event_id
        and sea.clinic_id = schedule_change_requests.clinic_id
    )
  );

alter table public.notifications enable row level security;

drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all"
  on public.notifications
  for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "notifications_clinic_select" on public.notifications;
create policy "notifications_clinic_select"
  on public.notifications
  for select
  to authenticated
  using (target = 'clinic' and public.is_clinic_member(clinic_id));

drop policy if exists "notifications_clinic_update" on public.notifications;
create policy "notifications_clinic_update"
  on public.notifications
  for update
  to authenticated
  using (target = 'clinic' and public.is_clinic_member(clinic_id))
  with check (target = 'clinic' and public.is_clinic_member(clinic_id));

create or replace function public.confirm_schedule_event(p_event_id uuid, p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_clinic_member(p_clinic_id) then
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
  if not public.is_clinic_member(p_clinic_id) then
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
