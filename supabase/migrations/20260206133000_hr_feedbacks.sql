create table if not exists public.hr_feedbacks (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  subject_user_id uuid not null references public.clinic_users(id) on delete cascade,
  department_id uuid references public.hr_departments(id) on delete set null,
  leader_id uuid references public.clinic_users(id) on delete set null,
  feedback_type text,
  feedback_date date not null,
  score_personal integer,
  score_management integer,
  result text,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists hr_feedbacks_clinic_id_idx on public.hr_feedbacks(clinic_id);
create index if not exists hr_feedbacks_subject_id_idx on public.hr_feedbacks(subject_user_id);
create index if not exists hr_feedbacks_date_idx on public.hr_feedbacks(feedback_date);

create table if not exists public.hr_feedback_participants (
  id uuid primary key default uuid_generate_v4(),
  feedback_id uuid not null references public.hr_feedbacks(id) on delete cascade,
  clinic_user_id uuid not null references public.clinic_users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (feedback_id, clinic_user_id)
);

create index if not exists hr_feedback_participants_feedback_id_idx on public.hr_feedback_participants(feedback_id);
create index if not exists hr_feedback_participants_user_id_idx on public.hr_feedback_participants(clinic_user_id);

alter table public.hr_feedbacks enable row level security;
alter table public.hr_feedback_participants enable row level security;

create or replace function public.is_feedback_participant(p_feedback_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.hr_feedback_participants p
    join public.clinic_users cu on cu.id = p.clinic_user_id
    where p.feedback_id = p_feedback_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  );
$$;

drop policy if exists "hr_feedbacks_select" on public.hr_feedbacks;
create policy "hr_feedbacks_select"
on public.hr_feedbacks
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_feedback_participant(id)
  or public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_feedbacks_insert" on public.hr_feedbacks;
create policy "hr_feedbacks_insert"
on public.hr_feedbacks
for insert
to authenticated
with check (
  public.is_clinic_member(clinic_id)
  and created_by = auth.uid()
);

drop policy if exists "hr_feedbacks_update" on public.hr_feedbacks;
create policy "hr_feedbacks_update"
on public.hr_feedbacks
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

drop policy if exists "hr_feedbacks_delete" on public.hr_feedbacks;
create policy "hr_feedbacks_delete"
on public.hr_feedbacks
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

drop policy if exists "hr_feedback_participants_select" on public.hr_feedback_participants;
create policy "hr_feedback_participants_select"
on public.hr_feedback_participants
for select
to authenticated
using (
  public.is_feedback_participant(feedback_id)
  or exists (
    select 1
    from public.hr_feedbacks f
    where f.id = hr_feedback_participants.feedback_id
      and (
        f.created_by = auth.uid()
        or public.is_clinic_admin(f.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_feedback_participants_insert" on public.hr_feedback_participants;
create policy "hr_feedback_participants_insert"
on public.hr_feedback_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hr_feedbacks f
    where f.id = feedback_id
      and (
        f.created_by = auth.uid()
        or public.is_clinic_admin(f.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_feedback_participants_delete" on public.hr_feedback_participants;
create policy "hr_feedback_participants_delete"
on public.hr_feedback_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.hr_feedbacks f
    where f.id = hr_feedback_participants.feedback_id
      and (
        f.created_by = auth.uid()
        or public.is_clinic_admin(f.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);
