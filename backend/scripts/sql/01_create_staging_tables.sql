create schema if not exists import_stg;

create table if not exists import_stg.customers (
  customer_code text,
  name text
);

create table if not exists import_stg.suppliers (
  supplier_code text,
  name text
);

create table if not exists import_stg.products (
  product_code text,
  name text,
  spec text,
  color text,
  base_unit text
);

create table if not exists import_stg.sales_orders (
  external_order_no text,
  customer_name text,
  order_date text,
  remarks text
);

create table if not exists import_stg.sales_order_items (
  external_order_no text,
  line_no int,
  product_code text,
  product_name text,
  color text,
  ordered_qty numeric(18,3),
  unit text,
  supplier_name text,
  supplier_delivery_date text,
  supplier_qty numeric(18,3),
  remarks text
);

create table if not exists import_stg.purchase_receipt_items_seed (
  supplier_name text,
  receipt_date text,
  product_code text,
  product_name text,
  received_qty numeric(18,3),
  unit text,
  related_external_order_no text
);
