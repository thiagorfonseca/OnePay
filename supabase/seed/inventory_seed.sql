-- Optional seed data for inventory module
-- Uses the first clinic found in the database.

with clinic as (
  select id from public.clinics order by created_at limit 1
), supplier as (
  insert into public.suppliers (clinic_id, nome, contato_nome, telefone, lead_time_days)
  select id, 'Distribuidora Alfa', 'Comercial', '11 99999-0000', 5 from clinic
  returning id, clinic_id
)
insert into public.inventory_items (
  clinic_id,
  name,
  category,
  manufacturer,
  default_supplier_id,
  unit,
  consumption_type,
  package_content,
  rounding_step,
  shelf_life_days,
  expires_after_open_hours,
  storage_type,
  min_stock,
  reorder_point,
  max_stock,
  lead_time_days
)
select
  clinic_id,
  'Toxina Botulínica 100U',
  'Toxina',
  'MarcaX',
  id,
  'UI',
  'fractional',
  100,
  1,
  365,
  24,
  'geladeira',
  10,
  20,
  100,
  5
from supplier;

with clinic as (
  select id from public.clinics order by created_at limit 1
), item as (
  select id, clinic_id from public.inventory_items where name = 'Toxina Botulínica 100U' limit 1
)
insert into public.inventory_item_barcodes (clinic_id, item_id, barcode, barcode_type)
select clinic_id, id, '7890000000000', 'EAN'
from item;

