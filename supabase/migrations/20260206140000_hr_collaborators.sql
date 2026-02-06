create table if not exists public.hr_collaborators (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  clinic_user_id uuid not null references public.clinic_users(id) on delete cascade,
  birth_date date,
  admission_date date,
  job_title text,
  function_title text,
  contract_type text,
  salary numeric(14,2),
  description text,
  archetype text,
  created_at timestamptz default now(),
  unique (clinic_user_id)
);

create index if not exists hr_collaborators_clinic_id_idx on public.hr_collaborators(clinic_id);
create index if not exists hr_collaborators_clinic_user_id_idx on public.hr_collaborators(clinic_user_id);

alter table public.hr_collaborators enable row level security;

drop policy if exists "hr_collaborators_select" on public.hr_collaborators;
create policy "hr_collaborators_select"
on public.hr_collaborators
for select
to authenticated
using (
  public.is_clinic_member(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_collaborators_insert" on public.hr_collaborators;
create policy "hr_collaborators_insert"
on public.hr_collaborators
for insert
to authenticated
with check (
  public.is_clinic_member(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_collaborators_update" on public.hr_collaborators;
create policy "hr_collaborators_update"
on public.hr_collaborators
for update
to authenticated
using (
  public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_collaborators_delete" on public.hr_collaborators;
create policy "hr_collaborators_delete"
on public.hr_collaborators
for delete
to authenticated
using (
  public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);
