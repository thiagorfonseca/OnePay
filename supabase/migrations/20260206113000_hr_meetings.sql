create table if not exists public.hr_meetings (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  title text not null,
  department text,
  meeting_type text,
  meeting_date date not null,
  meeting_time time,
  status text default 'Agendada',
  meeting_link text,
  agenda text,
  next_steps text,
  conductor_id uuid references public.clinic_users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists hr_meetings_clinic_id_idx on public.hr_meetings(clinic_id);
create index if not exists hr_meetings_meeting_date_idx on public.hr_meetings(meeting_date);

create table if not exists public.hr_meeting_participants (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.hr_meetings(id) on delete cascade,
  clinic_user_id uuid not null references public.clinic_users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (meeting_id, clinic_user_id)
);

create index if not exists hr_meeting_participants_meeting_id_idx on public.hr_meeting_participants(meeting_id);
create index if not exists hr_meeting_participants_user_id_idx on public.hr_meeting_participants(clinic_user_id);

alter table public.hr_meetings enable row level security;
alter table public.hr_meeting_participants enable row level security;

drop policy if exists "hr_meetings_select" on public.hr_meetings;
create policy "hr_meetings_select"
on public.hr_meetings
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.hr_meeting_participants p
    join public.clinic_users cu on cu.id = p.clinic_user_id
    where p.meeting_id = hr_meetings.id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meetings_insert" on public.hr_meetings;
create policy "hr_meetings_insert"
on public.hr_meetings
for insert
to authenticated
with check (
  public.is_clinic_member(clinic_id)
  and created_by = auth.uid()
);

drop policy if exists "hr_meetings_update" on public.hr_meetings;
create policy "hr_meetings_update"
on public.hr_meetings
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  created_by = auth.uid()
  or public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meetings_delete" on public.hr_meetings;
create policy "hr_meetings_delete"
on public.hr_meetings
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meeting_participants_select" on public.hr_meeting_participants;
create policy "hr_meeting_participants_select"
on public.hr_meeting_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.hr_meeting_participants p
    join public.clinic_users cu on cu.id = p.clinic_user_id
    where p.meeting_id = hr_meeting_participants.meeting_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  )
  or exists (
    select 1
    from public.hr_meetings m
    where m.id = hr_meeting_participants.meeting_id
      and m.created_by = auth.uid()
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meeting_participants_insert" on public.hr_meeting_participants;
create policy "hr_meeting_participants_insert"
on public.hr_meeting_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hr_meetings m
    where m.id = meeting_id
      and (
        m.created_by = auth.uid()
        or public.is_clinic_admin(m.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meeting_participants_delete" on public.hr_meeting_participants;
create policy "hr_meeting_participants_delete"
on public.hr_meeting_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.hr_meetings m
    where m.id = hr_meeting_participants.meeting_id
      and (
        m.created_by = auth.uid()
        or public.is_clinic_admin(m.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);
