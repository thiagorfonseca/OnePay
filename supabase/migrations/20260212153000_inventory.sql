-- Inventory module schema + RLS + views

-- 1) Helpers
create or replace function public.is_inventory_manager(p_clinic_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
      and cu.role in ('owner','admin','manager','stock_manager','inventory_manager')
  );
$$;

-- 2) Extend suppliers for inventory needs
alter table public.suppliers
  add column if not exists contato_nome text,
  add column if not exists email text,
  add column if not exists endereco text,
  add column if not exists lead_time_days integer,
  add column if not exists observacoes text,
  add column if not exists updated_at timestamptz default now();

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute procedure public.handle_updated_at();

create index if not exists suppliers_clinic_id_idx on public.suppliers(clinic_id);
create index if not exists suppliers_lead_time_idx on public.suppliers(lead_time_days);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select" on public.suppliers;
create policy "suppliers_select"
  on public.suppliers
  for select
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or public.is_system_admin()
  );


drop policy if exists "suppliers_insert" on public.suppliers;
create policy "suppliers_insert"
  on public.suppliers
  for insert
  to authenticated
  with check (
    public.is_inventory_manager(clinic_id) or public.is_system_admin()
  );


drop policy if exists "suppliers_update" on public.suppliers;
create policy "suppliers_update"
  on public.suppliers
  for update
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "suppliers_delete" on public.suppliers;
create policy "suppliers_delete"
  on public.suppliers
  for delete
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());

-- 3) Inventory core tables
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  category text,
  manufacturer text,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  unit text not null default 'UN',
  consumption_type text not null default 'whole'
    check (consumption_type in ('whole','fractional')),
  package_content numeric(14,4),
  rounding_step numeric(14,4) default 1,
  shelf_life_days integer,
  expires_after_open_hours integer,
  storage_type text,
  notes text,
  avg_cost numeric(14,4),
  last_cost numeric(14,4),
  tax_percent numeric(8,4),
  min_stock numeric(14,4),
  reorder_point numeric(14,4),
  max_stock numeric(14,4),
  lead_time_days integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists inventory_items_clinic_idx on public.inventory_items(clinic_id);
create index if not exists inventory_items_name_idx on public.inventory_items using gin (to_tsvector('portuguese', name));
create index if not exists inventory_items_supplier_idx on public.inventory_items(default_supplier_id);

alter table public.inventory_items enable row level security;

drop policy if exists "inventory_items_select" on public.inventory_items;
create policy "inventory_items_select"
  on public.inventory_items
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_items_insert" on public.inventory_items;
create policy "inventory_items_insert"
  on public.inventory_items
  for insert
  to authenticated
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_items_update" on public.inventory_items;
create policy "inventory_items_update"
  on public.inventory_items
  for update
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_items_delete" on public.inventory_items;
create policy "inventory_items_delete"
  on public.inventory_items
  for delete
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute procedure public.handle_updated_at();

create table if not exists public.inventory_item_barcodes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  barcode text not null,
  barcode_type text default 'EAN',
  created_at timestamptz default now(),
  unique (clinic_id, barcode)
);

create index if not exists inventory_item_barcodes_item_idx on public.inventory_item_barcodes(item_id);
create index if not exists inventory_item_barcodes_barcode_idx on public.inventory_item_barcodes(barcode);

alter table public.inventory_item_barcodes enable row level security;

drop policy if exists "inventory_item_barcodes_select" on public.inventory_item_barcodes;
create policy "inventory_item_barcodes_select"
  on public.inventory_item_barcodes
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_item_barcodes_manage" on public.inventory_item_barcodes;
create policy "inventory_item_barcodes_manage"
  on public.inventory_item_barcodes
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  issue_date date,
  received_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','posted','cancelled')),
  total_amount numeric(14,4),
  tax_amount numeric(14,4),
  notes text,
  xml_payload text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists purchase_invoices_clinic_idx on public.purchase_invoices(clinic_id);
create index if not exists purchase_invoices_supplier_idx on public.purchase_invoices(supplier_id);
create index if not exists purchase_invoices_issue_date_idx on public.purchase_invoices(issue_date);

alter table public.purchase_invoices enable row level security;

drop policy if exists "purchase_invoices_select" on public.purchase_invoices;
create policy "purchase_invoices_select"
  on public.purchase_invoices
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "purchase_invoices_manage" on public.purchase_invoices;
create policy "purchase_invoices_manage"
  on public.purchase_invoices
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop trigger if exists purchase_invoices_set_updated_at on public.purchase_invoices;
create trigger purchase_invoices_set_updated_at
before update on public.purchase_invoices
for each row execute procedure public.handle_updated_at();

create table if not exists public.purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  description text,
  quantity numeric(14,4) not null,
  unit_cost numeric(14,4),
  total_cost numeric(14,4),
  batch_code text,
  expiry_date date,
  manufacture_date date,
  barcode text,
  created_at timestamptz default now()
);

create index if not exists purchase_invoice_items_invoice_idx on public.purchase_invoice_items(invoice_id);
create index if not exists purchase_invoice_items_item_idx on public.purchase_invoice_items(item_id);
create index if not exists purchase_invoice_items_clinic_idx on public.purchase_invoice_items(clinic_id);

alter table public.purchase_invoice_items enable row level security;

drop policy if exists "purchase_invoice_items_select" on public.purchase_invoice_items;
create policy "purchase_invoice_items_select"
  on public.purchase_invoice_items
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "purchase_invoice_items_manage" on public.purchase_invoice_items;
create policy "purchase_invoice_items_manage"
  on public.purchase_invoice_items
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.purchase_invoice_files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  file_path text not null,
  file_type text,
  file_size integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists purchase_invoice_files_invoice_idx on public.purchase_invoice_files(invoice_id);

alter table public.purchase_invoice_files enable row level security;

drop policy if exists "purchase_invoice_files_select" on public.purchase_invoice_files;
create policy "purchase_invoice_files_select"
  on public.purchase_invoice_files
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "purchase_invoice_files_manage" on public.purchase_invoice_files;
create policy "purchase_invoice_files_manage"
  on public.purchase_invoice_files
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_item_id uuid references public.purchase_invoice_items(id) on delete set null,
  batch_code text,
  expiry_date date,
  received_at date,
  unit_cost numeric(14,4),
  initial_qty numeric(14,4),
  notes text,
  created_at timestamptz default now()
);

create index if not exists inventory_batches_clinic_idx on public.inventory_batches(clinic_id);
create index if not exists inventory_batches_item_idx on public.inventory_batches(item_id);
create index if not exists inventory_batches_expiry_idx on public.inventory_batches(expiry_date);
create index if not exists inventory_batches_batch_code_idx on public.inventory_batches(batch_code);

alter table public.inventory_batches enable row level security;

drop policy if exists "inventory_batches_select" on public.inventory_batches;
create policy "inventory_batches_select"
  on public.inventory_batches
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_batches_manage" on public.inventory_batches;
create policy "inventory_batches_manage"
  on public.inventory_batches
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.inventory_open_containers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  opened_at timestamptz not null default now(),
  expires_at timestamptz,
  total_qty numeric(14,4) not null,
  opened_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create index if not exists inventory_open_containers_clinic_idx on public.inventory_open_containers(clinic_id);
create index if not exists inventory_open_containers_item_idx on public.inventory_open_containers(item_id);
create index if not exists inventory_open_containers_expires_idx on public.inventory_open_containers(expires_at);

alter table public.inventory_open_containers enable row level security;

drop policy if exists "inventory_open_containers_select" on public.inventory_open_containers;
create policy "inventory_open_containers_select"
  on public.inventory_open_containers
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_open_containers_insert" on public.inventory_open_containers;
create policy "inventory_open_containers_insert"
  on public.inventory_open_containers
  for insert
  to authenticated
  with check (
    public.is_system_admin()
    or (public.is_clinic_member(clinic_id) and opened_by = auth.uid())
  );


drop policy if exists "inventory_open_containers_update" on public.inventory_open_containers;
create policy "inventory_open_containers_update"
  on public.inventory_open_containers
  for update
  to authenticated
  using (
    public.is_inventory_manager(clinic_id)
    or opened_by = auth.uid()
    or public.is_system_admin()
  )
  with check (
    public.is_inventory_manager(clinic_id)
    or opened_by = auth.uid()
    or public.is_system_admin()
  );


drop policy if exists "inventory_open_containers_delete" on public.inventory_open_containers;
create policy "inventory_open_containers_delete"
  on public.inventory_open_containers
  for delete
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  open_container_id uuid references public.inventory_open_containers(id) on delete set null,
  movement_type text not null
    check (movement_type in ('entry','consumption','loss','adjustment','inventory','transfer')),
  qty_delta numeric(14,4) not null check (qty_delta <> 0),
  unit_cost numeric(14,4),
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists inventory_movements_clinic_idx on public.inventory_movements(clinic_id);
create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id);
create index if not exists inventory_movements_batch_idx on public.inventory_movements(batch_id);
create index if not exists inventory_movements_container_idx on public.inventory_movements(open_container_id);
create index if not exists inventory_movements_type_idx on public.inventory_movements(movement_type);
create index if not exists inventory_movements_created_idx on public.inventory_movements(created_at);

alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_movements_select" on public.inventory_movements;
create policy "inventory_movements_select"
  on public.inventory_movements
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_movements_insert" on public.inventory_movements;
create policy "inventory_movements_insert"
  on public.inventory_movements
  for insert
  to authenticated
  with check (
    public.is_system_admin()
    or (
      public.is_clinic_member(clinic_id)
      and (
        public.is_inventory_manager(clinic_id)
        or (
          movement_type in ('consumption','loss')
          and created_by = auth.uid()
        )
      )
    )
  );


drop policy if exists "inventory_movements_update" on public.inventory_movements;
create policy "inventory_movements_update"
  on public.inventory_movements
  for update
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_movements_delete" on public.inventory_movements;
create policy "inventory_movements_delete"
  on public.inventory_movements
  for delete
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  count_date date not null default (now()::date),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','void')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists inventory_counts_clinic_idx on public.inventory_counts(clinic_id);
create index if not exists inventory_counts_status_idx on public.inventory_counts(status);

alter table public.inventory_counts enable row level security;

drop policy if exists "inventory_counts_select" on public.inventory_counts;
create policy "inventory_counts_select"
  on public.inventory_counts
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_counts_manage" on public.inventory_counts;
create policy "inventory_counts_manage"
  on public.inventory_counts
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop trigger if exists inventory_counts_set_updated_at on public.inventory_counts;
create trigger inventory_counts_set_updated_at
before update on public.inventory_counts
for each row execute procedure public.handle_updated_at();

create table if not exists public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  count_id uuid not null references public.inventory_counts(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  expected_qty numeric(14,4),
  counted_qty numeric(14,4) not null,
  diff_qty numeric(14,4),
  unit_cost numeric(14,4),
  notes text,
  created_at timestamptz default now()
);

create index if not exists inventory_count_lines_count_idx on public.inventory_count_lines(count_id);
create index if not exists inventory_count_lines_item_idx on public.inventory_count_lines(item_id);

alter table public.inventory_count_lines enable row level security;

drop policy if exists "inventory_count_lines_select" on public.inventory_count_lines;
create policy "inventory_count_lines_select"
  on public.inventory_count_lines
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "inventory_count_lines_manage" on public.inventory_count_lines;
create policy "inventory_count_lines_manage"
  on public.inventory_count_lines
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.stock_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  min_stock numeric(14,4),
  reorder_point numeric(14,4),
  max_stock numeric(14,4),
  lead_time_days integer,
  expiry_alert_days integer,
  open_expiry_alert_hours integer,
  price_variation_percent numeric(8,4),
  loss_spike_zscore numeric(8,4),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, item_id)
);

create index if not exists stock_rules_item_idx on public.stock_rules(item_id);

alter table public.stock_rules enable row level security;

drop policy if exists "stock_rules_select" on public.stock_rules;
create policy "stock_rules_select"
  on public.stock_rules
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "stock_rules_manage" on public.stock_rules;
create policy "stock_rules_manage"
  on public.stock_rules
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop trigger if exists stock_rules_set_updated_at on public.stock_rules;
create trigger stock_rules_set_updated_at
before update on public.stock_rules
for each row execute procedure public.handle_updated_at();

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  open_container_id uuid references public.inventory_open_containers(id) on delete set null,
  alert_type text not null
    check (alert_type in ('low_stock','expiry','open_expiry','rupture_risk','price_variation','loss_spike')),
  severity text not null default 'warning'
    check (severity in ('info','warning','critical')),
  status text not null default 'new'
    check (status in ('new','acknowledged','resolved')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);

create index if not exists alerts_clinic_idx on public.alerts(clinic_id);
create index if not exists alerts_status_idx on public.alerts(status);
create index if not exists alerts_type_idx on public.alerts(alert_type);
create index if not exists alerts_created_idx on public.alerts(created_at);

alter table public.alerts enable row level security;

drop policy if exists "alerts_select" on public.alerts;
create policy "alerts_select"
  on public.alerts
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "alerts_insert" on public.alerts;
create policy "alerts_insert"
  on public.alerts
  for insert
  to authenticated
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "alerts_update" on public.alerts;
create policy "alerts_update"
  on public.alerts
  for update
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "alerts_delete" on public.alerts;
create policy "alerts_delete"
  on public.alerts
  for delete
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  period_start date,
  period_end date,
  title text,
  summary text not null,
  data jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz default now()
);

create index if not exists ai_insights_clinic_idx on public.ai_insights(clinic_id);
create index if not exists ai_insights_created_idx on public.ai_insights(created_at);

alter table public.ai_insights enable row level security;

drop policy if exists "ai_insights_select" on public.ai_insights;
create policy "ai_insights_select"
  on public.ai_insights
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "ai_insights_manage" on public.ai_insights;
create policy "ai_insights_manage"
  on public.ai_insights
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  channel text not null check (channel in ('webhook','email','whatsapp')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sent','error')),
  last_error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

create index if not exists notification_outbox_clinic_idx on public.notification_outbox(clinic_id);
create index if not exists notification_outbox_status_idx on public.notification_outbox(status);

alter table public.notification_outbox enable row level security;

drop policy if exists "notification_outbox_select" on public.notification_outbox;
create policy "notification_outbox_select"
  on public.notification_outbox
  for select
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop policy if exists "notification_outbox_manage" on public.notification_outbox;
create policy "notification_outbox_manage"
  on public.notification_outbox
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

create table if not exists public.procedure_recipes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  procedure_id uuid references public.procedures(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists procedure_recipes_clinic_idx on public.procedure_recipes(clinic_id);
create index if not exists procedure_recipes_procedure_idx on public.procedure_recipes(procedure_id);

alter table public.procedure_recipes enable row level security;

drop policy if exists "procedure_recipes_select" on public.procedure_recipes;
create policy "procedure_recipes_select"
  on public.procedure_recipes
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "procedure_recipes_manage" on public.procedure_recipes;
create policy "procedure_recipes_manage"
  on public.procedure_recipes
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());


drop trigger if exists procedure_recipes_set_updated_at on public.procedure_recipes;
create trigger procedure_recipes_set_updated_at
before update on public.procedure_recipes
for each row execute procedure public.handle_updated_at();

create table if not exists public.procedure_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  recipe_id uuid not null references public.procedure_recipes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,4) not null,
  unit text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists procedure_recipe_lines_recipe_idx on public.procedure_recipe_lines(recipe_id);
create index if not exists procedure_recipe_lines_item_idx on public.procedure_recipe_lines(item_id);

alter table public.procedure_recipe_lines enable row level security;

drop policy if exists "procedure_recipe_lines_select" on public.procedure_recipe_lines;
create policy "procedure_recipe_lines_select"
  on public.procedure_recipe_lines
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin());


drop policy if exists "procedure_recipe_lines_manage" on public.procedure_recipe_lines;
create policy "procedure_recipe_lines_manage"
  on public.procedure_recipe_lines
  for all
  to authenticated
  using (public.is_inventory_manager(clinic_id) or public.is_system_admin())
  with check (public.is_inventory_manager(clinic_id) or public.is_system_admin());

-- 4) Views for balances and analytics
create or replace view public.inventory_item_stock as
select
  i.id as item_id,
  i.clinic_id,
  coalesce(sum(m.qty_delta), 0) as qty_on_hand,
  coalesce(sum(m.qty_delta * coalesce(m.unit_cost, 0)), 0) as stock_value
from public.inventory_items i
left join public.inventory_movements m
  on m.item_id = i.id
  and m.clinic_id = i.clinic_id
group by i.id, i.clinic_id;

create or replace view public.inventory_batch_stock as
select
  b.id as batch_id,
  b.item_id,
  b.clinic_id,
  b.expiry_date,
  coalesce(sum(m.qty_delta), 0) as qty_on_hand
from public.inventory_batches b
left join public.inventory_movements m
  on m.batch_id = b.id
  and m.clinic_id = b.clinic_id
group by b.id, b.item_id, b.clinic_id, b.expiry_date;

create or replace view public.inventory_open_container_status as
select
  oc.id,
  oc.clinic_id,
  oc.item_id,
  oc.batch_id,
  oc.opened_at,
  oc.expires_at,
  oc.total_qty,
  oc.opened_by,
  oc.closed_at,
  oc.notes,
  oc.created_at,
  (oc.total_qty + coalesce(sum(m.qty_delta), 0)) as remaining_qty
from public.inventory_open_containers oc
left join public.inventory_movements m
  on m.open_container_id = oc.id
  and m.clinic_id = oc.clinic_id
group by oc.id, oc.clinic_id, oc.item_id, oc.batch_id, oc.opened_at, oc.expires_at, oc.total_qty, oc.opened_by, oc.closed_at, oc.notes, oc.created_at;

create or replace view public.inventory_monthly_consumption as
select
  clinic_id,
  item_id,
  date_trunc('month', created_at)::date as month,
  sum(-qty_delta) as qty_consumed
from public.inventory_movements
where movement_type = 'consumption'
  and qty_delta < 0
group by clinic_id, item_id, date_trunc('month', created_at);

create or replace view public.inventory_monthly_losses as
select
  clinic_id,
  item_id,
  date_trunc('month', created_at)::date as month,
  sum(-qty_delta) as qty_lost
from public.inventory_movements
where movement_type = 'loss'
  and qty_delta < 0
group by clinic_id, item_id, date_trunc('month', created_at);

create or replace view public.inventory_last_purchase as
select
  clinic_id,
  item_id,
  max(created_at) filter (where movement_type = 'entry') as last_purchase_at,
  (array_agg(unit_cost order by created_at desc) filter (where movement_type = 'entry'))[1] as last_unit_cost,
  avg(unit_cost) filter (where movement_type = 'entry') as avg_unit_cost
from public.inventory_movements
group by clinic_id, item_id;

-- 5) RPC: create purchase invoice + batches + ledger
create or replace function public.create_purchase_invoice(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invoice_id uuid;
  v_item jsonb;
  v_items jsonb;
  v_item_id uuid;
  v_qty numeric(14,4);
  v_unit_cost numeric(14,4);
  v_total_cost numeric(14,4);
  v_batch_id uuid;
  v_invoice_item_id uuid;
  v_clinic_id uuid;
  v_supplier_id uuid;
begin
  v_clinic_id := (p_payload->>'clinic_id')::uuid;
  v_supplier_id := nullif(p_payload->>'supplier_id','')::uuid;

  if v_clinic_id is null then
    raise exception 'clinic_id obrigatório';
  end if;

  if not public.is_clinic_member(v_clinic_id) and not public.is_system_admin() then
    raise exception 'Sem acesso à clínica';
  end if;

  insert into public.purchase_invoices (
    clinic_id,
    supplier_id,
    invoice_number,
    issue_date,
    received_at,
    status,
    total_amount,
    tax_amount,
    notes,
    xml_payload,
    created_by
  ) values (
    v_clinic_id,
    v_supplier_id,
    nullif(p_payload->>'invoice_number',''),
    nullif(p_payload->>'issue_date','')::date,
    nullif(p_payload->>'received_at','')::timestamptz,
    coalesce(nullif(p_payload->>'status',''), 'posted'),
    nullif(p_payload->>'total_amount','')::numeric,
    nullif(p_payload->>'tax_amount','')::numeric,
    nullif(p_payload->>'notes',''),
    nullif(p_payload->>'xml_payload',''),
    auth.uid()
  ) returning id into v_invoice_id;

  v_items := p_payload->'items';
  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_item_id := nullif(v_item->>'item_id','')::uuid;
    if v_item_id is null then
      raise exception 'item_id obrigatório';
    end if;

    v_qty := coalesce(nullif(v_item->>'quantity','')::numeric, 0);
    v_unit_cost := nullif(v_item->>'unit_cost','')::numeric;
    v_total_cost := nullif(v_item->>'total_cost','')::numeric;

    insert into public.purchase_invoice_items (
      clinic_id,
      invoice_id,
      item_id,
      description,
      quantity,
      unit_cost,
      total_cost,
      batch_code,
      expiry_date,
      manufacture_date,
      barcode
    ) values (
      v_clinic_id,
      v_invoice_id,
      v_item_id,
      nullif(v_item->>'description',''),
      v_qty,
      v_unit_cost,
      v_total_cost,
      nullif(v_item->>'batch_code',''),
      nullif(v_item->>'expiry_date','')::date,
      nullif(v_item->>'manufacture_date','')::date,
      nullif(v_item->>'barcode','')
    ) returning id into v_invoice_item_id;

    if (v_item->>'batch_code') is not null or (v_item->>'expiry_date') is not null then
      insert into public.inventory_batches (
        clinic_id,
        item_id,
        supplier_id,
        invoice_item_id,
        batch_code,
        expiry_date,
        received_at,
        unit_cost,
        initial_qty,
        notes
      ) values (
        v_clinic_id,
        v_item_id,
        v_supplier_id,
        v_invoice_item_id,
        nullif(v_item->>'batch_code',''),
        nullif(v_item->>'expiry_date','')::date,
        nullif(v_item->>'received_at','')::date,
        v_unit_cost,
        v_qty,
        nullif(v_item->>'batch_notes','')
      ) returning id into v_batch_id;
    else
      v_batch_id := null;
    end if;

    insert into public.inventory_movements (
      clinic_id,
      item_id,
      batch_id,
      movement_type,
      qty_delta,
      unit_cost,
      reason,
      reference_type,
      reference_id,
      created_by
    ) values (
      v_clinic_id,
      v_item_id,
      v_batch_id,
      'entry',
      v_qty,
      v_unit_cost,
      'purchase_invoice',
      'purchase_invoice',
      v_invoice_id,
      auth.uid()
    );

    update public.inventory_items
      set last_cost = v_unit_cost,
          avg_cost = (
            select avg(unit_cost)
            from public.inventory_movements im
            where im.item_id = v_item_id
              and im.clinic_id = v_clinic_id
              and im.movement_type = 'entry'
              and im.unit_cost is not null
          )
    where id = v_item_id;
  end loop;

  return v_invoice_id;
end;
$$;

grant execute on function public.create_purchase_invoice(jsonb) to authenticated;

-- 6) Storage bucket for invoice files
insert into storage.buckets (id, name, public)
values ('inventory-docs', 'inventory-docs', false)
on conflict (id) do nothing;

drop policy if exists "inventory_docs_select" on storage.objects;
drop policy if exists "inventory_docs_insert" on storage.objects;
drop policy if exists "inventory_docs_update" on storage.objects;
drop policy if exists "inventory_docs_delete" on storage.objects;

create policy "inventory_docs_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inventory-docs'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] is not null
  and public.is_clinic_member((storage.foldername(name))[2]::uuid)
);

create policy "inventory_docs_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inventory-docs'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] is not null
  and (public.is_inventory_manager((storage.foldername(name))[2]::uuid) or public.is_system_admin())
);

create policy "inventory_docs_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'inventory-docs'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] is not null
  and (public.is_inventory_manager((storage.foldername(name))[2]::uuid) or public.is_system_admin())
)
with check (
  bucket_id = 'inventory-docs'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] is not null
  and (public.is_inventory_manager((storage.foldername(name))[2]::uuid) or public.is_system_admin())
);

create policy "inventory_docs_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inventory-docs'
  and (storage.foldername(name))[1] = 'clinics'
  and (storage.foldername(name))[2] is not null
  and (public.is_inventory_manager((storage.foldername(name))[2]::uuid) or public.is_system_admin())
);
