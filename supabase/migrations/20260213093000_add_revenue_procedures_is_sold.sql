alter table public.revenue_procedures
  add column if not exists is_sold boolean not null default true;
