-- CargoSystem post-import validation report
-- Run after:
-- 01_create_staging_tables.sql
-- 01b_create_staging_tables_delivery_invoice.sql
-- 02_load_and_transform.sql
-- 03_load_delivery_and_invoice.sql

-- 1) Core master data count
select 'customers' as metric, count(*)::bigint as value from customers
union all
select 'suppliers', count(*)::bigint from suppliers
union all
select 'products', count(*)::bigint from products
union all
select 'units', count(*)::bigint from units
union all
select 'warehouses', count(*)::bigint from warehouses;

-- 2) Core transaction count
select 'sales_orders' as metric, count(*)::bigint as value from sales_orders
union all
select 'sales_order_items', count(*)::bigint from sales_order_items
union all
select 'delivery_orders', count(*)::bigint from delivery_orders
union all
select 'delivery_order_items', count(*)::bigint from delivery_order_items
union all
select 'invoices', count(*)::bigint from invoices;

-- 3) Staging vs business count (quick reconcile)
select
  'sales_orders' as subject,
  (select count(*) from import_stg.sales_orders) as stg_count,
  (select count(*) from sales_orders) as biz_count
union all
select
  'sales_order_items',
  (select count(*) from import_stg.sales_order_items),
  (select count(*) from sales_order_items)
union all
select
  'delivery_orders',
  (select count(*) from import_stg.delivery_orders),
  (select count(*) from delivery_orders)
union all
select
  'delivery_order_items',
  (select count(*) from import_stg.delivery_order_items),
  (select count(*) from delivery_order_items)
union all
select
  'invoices',
  (select count(*) from import_stg.invoices),
  (select count(*) from invoices);

-- 4) Invoice total amount reconcile
select
  coalesce(sum(total_amount), 0)::numeric(18,2) as biz_invoice_total,
  coalesce((select sum(total_amount) from import_stg.invoices), 0)::numeric(18,2) as stg_invoice_total,
  (coalesce(sum(total_amount), 0) - coalesce((select sum(total_amount) from import_stg.invoices), 0))::numeric(18,2) as diff
from invoices;

-- 5) Delivery qty reconcile
select
  coalesce(sum(delivered_qty), 0)::numeric(18,3) as biz_delivery_qty,
  coalesce((select sum(delivered_qty) from import_stg.delivery_order_items), 0)::numeric(18,3) as stg_delivery_qty,
  (coalesce(sum(delivered_qty), 0) - coalesce((select sum(delivered_qty) from import_stg.delivery_order_items), 0))::numeric(18,3) as diff
from delivery_order_items;

-- 6) Missing relationship checks
-- 6.1 delivery items without delivery header
select count(*)::bigint as orphan_delivery_items
from delivery_order_items doi
left join delivery_orders d on d.id = doi.delivery_order_id
where d.id is null;

-- 6.2 invoice linked to missing customer
select count(*)::bigint as invoice_missing_customer
from invoices i
left join customers c on c.id = i.customer_id
where c.id is null;

-- 6.3 delivery linked to missing customer
select count(*)::bigint as delivery_missing_customer
from delivery_orders d
left join customers c on c.id = d.customer_id
where c.id is null;

-- 7) Potential duplicate risk
-- Same customer + date + amount appears multiple times
select
  c.name as customer_name,
  i.invoice_date,
  i.total_amount,
  count(*)::bigint as dup_count
from invoices i
join customers c on c.id = i.customer_id
group by c.name, i.invoice_date, i.total_amount
having count(*) > 1
order by dup_count desc, i.invoice_date desc
limit 50;

-- 8) Top customers by receivable (from imported invoices)
select
  c.name as customer_name,
  count(i.id)::bigint as invoice_count,
  coalesce(sum(i.total_amount), 0)::numeric(18,2) as total_amount
from invoices i
join customers c on c.id = i.customer_id
group by c.name
order by total_amount desc
limit 20;

-- 9) Delivery orders without invoice link
select
  d.delivery_no,
  c.name as customer_name,
  d.delivery_date
from delivery_orders d
join customers c on c.id = d.customer_id
left join invoices i on i.delivery_order_id = d.id
where i.id is null
order by d.delivery_date desc
limit 100;

-- 10) Sales order status distribution
select status, count(*)::bigint
from sales_orders
group by status
order by count(*) desc;

-- 11) Delivery order status distribution
select status, count(*)::bigint
from delivery_orders
group by status
order by count(*) desc;
