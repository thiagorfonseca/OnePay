create table if not exists public.pricing_expenses (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  categoria text not null,
  nome text not null,
  valor_base numeric(14,2) not null,
  valor_calculado numeric(14,2) not null,
  created_at timestamptz default now()
);

alter table public.pricing_expenses
  add column if not exists categoria text,
  add column if not exists nome text,
  add column if not exists valor_base numeric(14,2),
  add column if not exists valor_calculado numeric(14,2);

alter table public.pricing_expenses enable row level security;

drop policy if exists "Authenticated access" on public.pricing_expenses;
create policy "Authenticated access" on public.pricing_expenses for all
  to authenticated using (true) with check (true);
