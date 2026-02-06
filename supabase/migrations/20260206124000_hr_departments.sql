create table if not exists public.hr_departments (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (clinic_id, name)
);

create table if not exists public.hr_department_affiliations (
  id uuid primary key default uuid_generate_v4(),
  department_id uuid not null references public.hr_departments(id) on delete cascade,
  affiliated_department_id uuid not null references public.hr_departments(id) on delete cascade,
  created_at timestamptz default now(),
  unique (department_id, affiliated_department_id)
);

create index if not exists hr_departments_clinic_id_idx on public.hr_departments(clinic_id);
create index if not exists hr_department_affiliations_department_id_idx on public.hr_department_affiliations(department_id);
create index if not exists hr_department_affiliations_affiliated_id_idx on public.hr_department_affiliations(affiliated_department_id);

alter table public.hr_departments enable row level security;
alter table public.hr_department_affiliations enable row level security;

drop policy if exists "hr_departments_select" on public.hr_departments;
create policy "hr_departments_select"
on public.hr_departments
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

drop policy if exists "hr_departments_insert" on public.hr_departments;
create policy "hr_departments_insert"
on public.hr_departments
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

drop policy if exists "hr_departments_update" on public.hr_departments;
create policy "hr_departments_update"
on public.hr_departments
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

drop policy if exists "hr_departments_delete" on public.hr_departments;
create policy "hr_departments_delete"
on public.hr_departments
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

drop policy if exists "hr_department_affiliations_select" on public.hr_department_affiliations;
create policy "hr_department_affiliations_select"
on public.hr_department_affiliations
for select
to authenticated
using (
  exists (
    select 1
    from public.hr_departments d
    where d.id = hr_department_affiliations.department_id
      and public.is_clinic_member(d.clinic_id)
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_department_affiliations_insert" on public.hr_department_affiliations;
create policy "hr_department_affiliations_insert"
on public.hr_department_affiliations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hr_departments d
    where d.id = department_id
      and public.is_clinic_admin(d.clinic_id)
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_department_affiliations_delete" on public.hr_department_affiliations;
create policy "hr_department_affiliations_delete"
on public.hr_department_affiliations
for delete
to authenticated
using (
  exists (
    select 1
    from public.hr_departments d
    where d.id = hr_department_affiliations.department_id
      and public.is_clinic_admin(d.clinic_id)
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);
