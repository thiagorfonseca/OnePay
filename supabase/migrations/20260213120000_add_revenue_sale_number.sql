do $$
begin
  if not exists (select 1 from pg_class where relname = 'revenue_sale_number_seq') then
    create sequence public.revenue_sale_number_seq;
  end if;
end $$;

alter table public.revenues
  add column if not exists sale_number text;

alter table public.revenues
  alter column sale_number set default nextval('public.revenue_sale_number_seq')::text;

update public.revenues
  set sale_number = nextval('public.revenue_sale_number_seq')::text
where sale_number is null;

alter table public.revenues
  alter column sale_number set not null;

create unique index if not exists revenues_sale_number_key on public.revenues (sale_number);
