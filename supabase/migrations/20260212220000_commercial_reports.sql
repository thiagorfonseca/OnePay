create table if not exists public.commercial_contracts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  products text[] not null default '{}'::text[],
  package_id uuid null references public.content_packages(id) on delete set null,
  amount_cents integer null,
  start_date date null,
  end_date date null,
  status text not null default 'ativo'
    check (status in ('ativo', 'vencendo', 'encerrado', 'cancelado')),
  owner_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists commercial_contracts_clinic_unique
  on public.commercial_contracts(clinic_id);

create index if not exists commercial_contracts_status_idx
  on public.commercial_contracts(status);

create index if not exists commercial_contracts_start_date_idx
  on public.commercial_contracts(start_date);

create index if not exists commercial_contracts_end_date_idx
  on public.commercial_contracts(end_date);

create index if not exists commercial_contracts_amount_idx
  on public.commercial_contracts(amount_cents);

create index if not exists commercial_contracts_owner_idx
  on public.commercial_contracts(owner_user_id);

create trigger commercial_contracts_set_updated_at
before update on public.commercial_contracts
for each row execute procedure public.handle_updated_at();

alter table public.commercial_contracts enable row level security;

drop policy if exists "commercial_contracts_internal" on public.commercial_contracts;
create policy "commercial_contracts_internal"
  on public.commercial_contracts
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create table if not exists public.sales_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index integer not null default 0,
  is_archived_stage boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sales_stages_order_idx
  on public.sales_stages(order_index);

create trigger sales_stages_set_updated_at
before update on public.sales_stages
for each row execute procedure public.handle_updated_at();

alter table public.sales_stages enable row level security;

drop policy if exists "sales_stages_internal" on public.sales_stages;
create policy "sales_stages_internal"
  on public.sales_stages
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  tenant_candidate_name text,
  email text,
  phone text,
  whatsapp text,
  source text,
  owner_user_id uuid null references auth.users(id) on delete set null,
  value_potential_cents integer null,
  status text not null default 'ativo'
    check (status in ('ativo', 'ganho', 'perdido', 'arquivado')),
  current_stage_id uuid null references public.sales_stages(id) on delete set null,
  last_interaction_at timestamptz null,
  next_follow_up_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sales_leads_status_idx
  on public.sales_leads(status);

create index if not exists sales_leads_stage_idx
  on public.sales_leads(current_stage_id);

create index if not exists sales_leads_owner_idx
  on public.sales_leads(owner_user_id);

create index if not exists sales_leads_created_at_idx
  on public.sales_leads(created_at desc);

create index if not exists sales_leads_value_idx
  on public.sales_leads(value_potential_cents);

create index if not exists sales_leads_source_idx
  on public.sales_leads(source);

create trigger sales_leads_set_updated_at
before update on public.sales_leads
for each row execute procedure public.handle_updated_at();

alter table public.sales_leads enable row level security;

drop policy if exists "sales_leads_internal" on public.sales_leads;
create policy "sales_leads_internal"
  on public.sales_leads
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  type text not null check (type in ('call', 'msg', 'meeting', 'note')),
  notes text,
  next_follow_up_at timestamptz null,
  created_at timestamptz default now()
);

create index if not exists sales_activities_lead_idx
  on public.sales_activities(lead_id);

alter table public.sales_activities enable row level security;

drop policy if exists "sales_activities_internal" on public.sales_activities;
create policy "sales_activities_internal"
  on public.sales_activities
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create table if not exists public.sales_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  template text,
  scheduled_at timestamptz null,
  sent_at timestamptz null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz default now()
);

create index if not exists sales_sequences_lead_idx
  on public.sales_sequences(lead_id);

alter table public.sales_sequences enable row level security;

drop policy if exists "sales_sequences_internal" on public.sales_sequences;
create policy "sales_sequences_internal"
  on public.sales_sequences
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create table if not exists public.sales_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  from_stage_id uuid null references public.sales_stages(id) on delete set null,
  to_stage_id uuid null references public.sales_stages(id) on delete set null,
  changed_by uuid null references auth.users(id) on delete set null,
  changed_at timestamptz default now()
);

create index if not exists sales_stage_history_lead_idx
  on public.sales_stage_history(lead_id);

alter table public.sales_stage_history enable row level security;

drop policy if exists "sales_stage_history_internal" on public.sales_stage_history;
create policy "sales_stage_history_internal"
  on public.sales_stage_history
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

create or replace function public.log_sales_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_stage_id is distinct from old.current_stage_id then
    insert into public.sales_stage_history (lead_id, from_stage_id, to_stage_id, changed_by, changed_at)
    values (new.id, old.current_stage_id, new.current_stage_id, auth.uid(), now());
  end if;
  return new;
end;
$$;

drop trigger if exists sales_leads_log_stage_change on public.sales_leads;
create trigger sales_leads_log_stage_change
before update on public.sales_leads
for each row execute procedure public.log_sales_stage_change();

create or replace function public.sync_sales_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sales_leads
    set last_interaction_at = new.created_at,
        next_follow_up_at = coalesce(new.next_follow_up_at, next_follow_up_at)
  where id = new.lead_id;
  return new;
end;
$$;

drop trigger if exists sales_activities_sync_lead on public.sales_activities;
create trigger sales_activities_sync_lead
after insert on public.sales_activities
for each row execute procedure public.sync_sales_activity();

drop policy if exists "profiles_select_internal" on public.profiles;
create policy "profiles_select_internal"
on public.profiles
for select
to authenticated
using (public.is_one_doctor_internal());
