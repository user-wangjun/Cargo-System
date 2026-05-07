-- Run in psql after executing 01_create_staging_tables.sql
-- Adjust absolute file paths if needed.
--
-- \copy import_stg.customers from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/customers.csv' csv header encoding 'utf8'
-- \copy import_stg.suppliers from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/suppliers.csv' csv header encoding 'utf8'
-- \copy import_stg.products from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/products.csv' csv header encoding 'utf8'
-- \copy import_stg.sales_orders from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/sales_orders.csv' csv header encoding 'utf8'
-- \copy import_stg.sales_order_items from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/sales_order_items.csv' csv header encoding 'utf8'
-- \copy import_stg.purchase_receipt_items_seed from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/purchase_receipt_items_seed.csv' csv header encoding 'utf8'

begin;

insert into units (unit_code, name)
select distinct trim(base_unit), trim(base_unit)
from import_stg.products
where coalesce(trim(base_unit), '') <> ''
on conflict (unit_code) do nothing;

insert into units (unit_code, name)
select distinct trim(unit), trim(unit)
from import_stg.sales_order_items
where coalesce(trim(unit), '') <> ''
on conflict (unit_code) do nothing;

insert into units (unit_code, name)
select distinct trim(unit), trim(unit)
from import_stg.purchase_receipt_items_seed
where coalesce(trim(unit), '') <> ''
on conflict (unit_code) do nothing;

insert into customers (customer_code, name, is_active)
select distinct
  left(coalesce(nullif(trim(customer_code), ''), trim(name)), 50) as customer_code,
  trim(name) as name,
  true
from import_stg.customers
where coalesce(trim(name), '') <> ''
on conflict (customer_code) do update set name = excluded.name, updated_at = now();

insert into suppliers (supplier_code, name, is_active)
select distinct
  left(coalesce(nullif(trim(supplier_code), ''), trim(name)), 50) as supplier_code,
  trim(name) as name,
  true
from import_stg.suppliers
where coalesce(trim(name), '') <> ''
on conflict (supplier_code) do update set name = excluded.name, updated_at = now();

insert into products (product_code, name, base_unit_id, spec, color, is_active)
select distinct
  left(trim(p.product_code), 80) as product_code,
  coalesce(nullif(trim(p.name), ''), trim(p.product_code)) as name,
  u.id as base_unit_id,
  nullif(trim(p.spec), ''),
  nullif(trim(p.color), ''),
  true
from import_stg.products p
join units u on u.unit_code = trim(p.base_unit)
where coalesce(trim(p.product_code), '') <> ''
on conflict (product_code) do update
set
  name = excluded.name,
  base_unit_id = excluded.base_unit_id,
  spec = excluded.spec,
  color = excluded.color,
  updated_at = now();

insert into unit_conversions (product_id, from_unit_id, to_unit_id, factor)
select p.id, u.id, p.base_unit_id, 1
from products p
join units u on u.id = p.base_unit_id
on conflict (product_id, from_unit_id, to_unit_id) do nothing;

insert into sales_orders (order_no, customer_id, order_date, status, remarks, created_by)
select
  left(trim(s.external_order_no), 50) as order_no,
  c.id as customer_id,
  coalesce(nullif(trim(s.order_date), '')::date, current_date),
  'CONFIRMED',
  nullif(trim(s.remarks), ''),
  '00000000-0000-0000-0000-000000000001'
from import_stg.sales_orders s
join customers c on c.name = trim(s.customer_name)
where coalesce(trim(s.external_order_no), '') <> ''
on conflict (order_no) do update
set
  customer_id = excluded.customer_id,
  order_date = excluded.order_date,
  remarks = excluded.remarks,
  updated_at = now();

delete from sales_order_items soi
using sales_orders so
where soi.sales_order_id = so.id
  and so.order_no in (select distinct trim(external_order_no) from import_stg.sales_order_items);

insert into sales_order_items (sales_order_id, line_no, product_id, ordered_qty, unit_id, unit_price, amount)
select
  so.id as sales_order_id,
  i.line_no,
  p.id as product_id,
  i.ordered_qty,
  u.id as unit_id,
  null,
  null
from import_stg.sales_order_items i
join sales_orders so on so.order_no = trim(i.external_order_no)
join products p on p.product_code = trim(i.product_code)
join units u on u.unit_code = trim(i.unit)
where i.ordered_qty is not null;

commit;
