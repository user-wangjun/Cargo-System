-- Run in psql after:
-- 1) docs/mvp-schema.sql
-- 2) 01_create_staging_tables.sql and 01b_create_staging_tables_delivery_invoice.sql
--
-- \copy import_stg.delivery_orders from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/delivery_orders.csv' csv header encoding 'utf8'
-- \copy import_stg.delivery_order_items from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/delivery_order_items.csv' csv header encoding 'utf8'
-- \copy import_stg.invoices from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/invoices.csv' csv header encoding 'utf8'
-- \copy import_stg.invoice_lines from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/invoice_lines.csv' csv header encoding 'utf8'

begin;

-- Ensure baseline data exists
insert into users (id, username, password_hash, full_name, is_active)
values ('00000000-0000-0000-0000-000000000001', 'admin', 'mock-hash', 'System Admin', true)
on conflict (id) do nothing;

insert into warehouses (warehouse_code, name)
select 'MAIN', '主仓'
where not exists (select 1 from warehouses);

-- Units from delivery/invoice
insert into units (unit_code, name)
select distinct trim(unit), trim(unit)
from import_stg.delivery_order_items
where coalesce(trim(unit), '') <> ''
on conflict (unit_code) do nothing;

insert into units (unit_code, name)
select distinct trim(unit), trim(unit)
from import_stg.invoice_lines
where coalesce(trim(unit), '') <> ''
on conflict (unit_code) do nothing;

-- Customers
insert into customers (customer_code, name, is_active)
select distinct left(trim(customer_name), 50), trim(customer_name), true
from import_stg.delivery_orders
where coalesce(trim(customer_name), '') <> ''
on conflict (customer_code) do update set name = excluded.name, updated_at = now();

insert into customers (customer_code, name, is_active)
select distinct left(trim(customer_name), 50), trim(customer_name), true
from import_stg.invoices
where coalesce(trim(customer_name), '') <> ''
on conflict (customer_code) do update set name = excluded.name, updated_at = now();

-- Products (fallback to generated code when source has no product_code)
with src_raw as (
  select distinct
    coalesce(nullif(trim(product_code), ''), 'AUTO-' || substr(md5(trim(product_name) || '|' || coalesce(trim(spec), '') || '|' || coalesce(trim(color), '')), 1, 20)) as product_code_norm,
    coalesce(nullif(trim(product_name), ''), '未命名商品') as product_name_norm,
    nullif(trim(spec), '') as spec_norm,
    nullif(trim(color), '') as color_norm,
    coalesce(nullif(trim(unit), ''), 'Y') as base_unit_code
  from import_stg.delivery_order_items
  where coalesce(trim(product_name), '') <> '' or coalesce(trim(product_code), '') <> ''
), src as (
  select
    product_code_norm,
    max(product_name_norm) as product_name_norm,
    max(spec_norm) as spec_norm,
    max(color_norm) as color_norm,
    max(base_unit_code) as base_unit_code
  from src_raw
  group by product_code_norm
)
insert into products (product_code, name, base_unit_id, spec, color, is_active)
select
  left(s.product_code_norm, 80),
  s.product_name_norm,
  u.id,
  s.spec_norm,
  s.color_norm,
  true
from src s
join units u on u.unit_code = s.base_unit_code
on conflict (product_code) do update
set
  name = excluded.name,
  base_unit_id = excluded.base_unit_id,
  spec = excluded.spec,
  color = excluded.color,
  updated_at = now();

-- Ensure identity unit conversion
insert into unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id, p.base_unit_id, p.base_unit_id, 1
from products p
on conflict (product_id, from_unit_id, to_unit_id) do nothing;

-- Delivery headers
insert into delivery_orders
  (delivery_no, customer_id, warehouse_id, delivery_date, status, printed_at, remarks, created_by)
select
  left(trim(d.delivery_no), 50),
  c.id,
  w.id,
  case
    when d.delivery_date ~ '^\d+(\.\d+)?$' then (date '1899-12-30' + floor(d.delivery_date::numeric)::int)
    when d.delivery_date ~ '^\d{4}-\d{1,2}-\d{1,2}' then left(d.delivery_date, 10)::date
    when d.delivery_date ~ '^\d{4}/\d{1,2}/\d{1,2}' then to_date(d.delivery_date, 'YYYY/MM/DD')
    else current_date
  end as delivery_date_parsed,
  'PRINTED',
  now(),
  nullif(trim(d.remarks), ''),
  '00000000-0000-0000-0000-000000000001'
from import_stg.delivery_orders d
join customers c on c.name = trim(d.customer_name)
cross join lateral (
  select id from warehouses order by created_at asc limit 1
) w
where coalesce(trim(d.delivery_no), '') <> ''
on conflict (delivery_no) do update
set
  customer_id = excluded.customer_id,
  warehouse_id = excluded.warehouse_id,
  delivery_date = excluded.delivery_date,
  status = excluded.status,
  printed_at = excluded.printed_at,
  remarks = excluded.remarks,
  updated_at = now();

-- Refresh delivery items for imported delivery_no
delete from delivery_order_items doi
using delivery_orders d
where doi.delivery_order_id = d.id
  and d.delivery_no in (
    select distinct trim(delivery_no)
    from import_stg.delivery_order_items
    where coalesce(trim(delivery_no), '') <> ''
  );

insert into delivery_order_items
  (delivery_order_id, line_no, product_id, delivered_qty, unit_id, converted_base_qty, related_sales_order_item_id)
select
  d.id,
  coalesce(i.line_no, row_number() over (partition by i.delivery_no order by i.line_no)),
  p.id,
  coalesce(i.delivered_qty, 0),
  u.id,
  coalesce(i.delivered_qty, 0),
  null
from import_stg.delivery_order_items i
join delivery_orders d on d.delivery_no = trim(i.delivery_no)
join units u on u.unit_code = coalesce(nullif(trim(i.unit), ''), 'Y')
join products p on p.product_code =
  coalesce(
    nullif(trim(i.product_code), ''),
    'AUTO-' || substr(md5(trim(i.product_name) || '|' || coalesce(trim(i.spec), '') || '|' || coalesce(trim(i.color), '')), 1, 20)
  )
where coalesce(i.delivered_qty, 0) > 0;

-- Invoices
insert into invoices
  (invoice_no, customer_id, delivery_order_id, invoice_date, total_amount, status, created_by)
select
  left(trim(i.invoice_no), 50),
  c.id,
  d.id,
  case
    when i.invoice_date_raw ~ '^\d+(\.\d+)?$' then (date '1899-12-30' + floor(i.invoice_date_raw::numeric)::int)
    when i.invoice_date_raw ~ '^\d{4}-\d{1,2}-\d{1,2}' then left(i.invoice_date_raw, 10)::date
    when i.invoice_date_raw ~ '^\d{4}/\d{1,2}/\d{1,2}' then to_date(i.invoice_date_raw, 'YYYY/MM/DD')
    else current_date
  end as invoice_date_parsed,
  coalesce(i.total_amount, 0),
  'ISSUED',
  '00000000-0000-0000-0000-000000000001'
from import_stg.invoices i
join customers c on c.name = trim(i.customer_name)
left join delivery_orders d on d.delivery_no = trim(i.delivery_no)
where coalesce(trim(i.invoice_no), '') <> ''
on conflict (invoice_no) do update
set
  customer_id = excluded.customer_id,
  delivery_order_id = excluded.delivery_order_id,
  invoice_date = excluded.invoice_date,
  total_amount = excluded.total_amount,
  status = excluded.status,
  updated_at = now();

commit;
