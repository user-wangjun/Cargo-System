create schema if not exists import_stg;

create table if not exists import_stg.delivery_orders (
  delivery_no text,
  customer_name text,
  delivery_date text,
  source_sheet text,
  remarks text
);

create table if not exists import_stg.delivery_order_items (
  delivery_no text,
  line_no int,
  customer_name text,
  delivery_date text,
  customer_order_no text,
  instruction_no text,
  product_code text,
  product_name text,
  spec text,
  color text,
  delivered_qty numeric(18,3),
  unit text,
  unit_price numeric(18,3),
  amount numeric(18,3),
  remark text,
  source_sheet text
);

create table if not exists import_stg.invoices (
  invoice_no text,
  delivery_no text,
  customer_name text,
  invoice_date_raw text,
  total_amount numeric(18,2),
  source_sheet text
);

create table if not exists import_stg.invoice_lines (
  delivery_no text,
  customer_name text,
  invoice_date_raw text,
  customer_order_no text,
  instruction_no text,
  product_name text,
  spec text,
  color text,
  qty numeric(18,3),
  unit text,
  unit_price numeric(18,3),
  amount numeric(18,3),
  remark text,
  source_sheet text
);
