-- CargoSystem MVP schema (single-company)
-- PostgreSQL 14+

create extension if not exists pgcrypto;

-- 1) auth & permission
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code varchar(50) not null unique,
  name varchar(100) not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username varchar(100) not null unique,
  password_hash text not null,
  full_name varchar(100) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  primary key (user_id, role_id)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code varchar(100) not null unique,
  name varchar(100) not null
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  primary key (role_id, permission_id)
);

-- 2) master data
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_code varchar(50) not null unique,
  name varchar(200) not null,
  contact_name varchar(100),
  phone varchar(30),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code varchar(50) not null unique,
  name varchar(200) not null,
  contact_name varchar(100),
  phone varchar(30),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code varchar(50) not null unique,
  name varchar(100) not null,
  created_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  unit_code varchar(30) not null unique,
  name varchar(50) not null
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_code varchar(80) not null unique,
  name varchar(200) not null,
  base_unit_id uuid not null references units(id),
  spec varchar(120),
  color varchar(80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unit conversion: from_unit * factor = to_unit
create table if not exists unit_conversions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  from_unit_id uuid not null references units(id),
  to_unit_id uuid not null references units(id),
  factor numeric(18,6) not null check (factor > 0),
  unique (product_id, from_unit_id, to_unit_id)
);

-- 3) sales order
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_no varchar(50) not null unique,
  customer_id uuid not null references customers(id),
  order_date date not null,
  status varchar(30) not null default 'DRAFT',
  remarks text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  line_no int not null,
  product_id uuid not null references products(id),
  ordered_qty numeric(18,3) not null check (ordered_qty > 0),
  unit_id uuid not null references units(id),
  unit_price numeric(18,2),
  amount numeric(18,2),
  unique (sales_order_id, line_no)
);

-- 4) purchase receipt (supplier delivery)
create table if not exists purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no varchar(50) not null unique,
  supplier_id uuid not null references suppliers(id),
  receipt_date date not null,
  status varchar(30) not null default 'DRAFT',
  remarks text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  purchase_receipt_id uuid not null references purchase_receipts(id) on delete cascade,
  line_no int not null,
  product_id uuid not null references products(id),
  received_qty numeric(18,3) not null check (received_qty > 0),
  unit_id uuid not null references units(id),
  converted_base_qty numeric(18,3) not null check (converted_base_qty > 0),
  related_sales_order_item_id uuid references sales_order_items(id),
  unique (purchase_receipt_id, line_no)
);

-- 5) delivery order
create table if not exists delivery_orders (
  id uuid primary key default gen_random_uuid(),
  delivery_no varchar(50) not null unique,
  customer_id uuid not null references customers(id),
  warehouse_id uuid not null references warehouses(id),
  delivery_date date not null,
  status varchar(30) not null default 'DRAFT',
  printed_at timestamptz,
  remarks text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references delivery_orders(id) on delete cascade,
  line_no int not null,
  product_id uuid not null references products(id),
  delivered_qty numeric(18,3) not null check (delivered_qty > 0),
  unit_id uuid not null references units(id),
  converted_base_qty numeric(18,3) not null check (converted_base_qty > 0),
  related_sales_order_item_id uuid references sales_order_items(id),
  unique (delivery_order_id, line_no)
);

-- 6) inventory
create table if not exists inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  biz_type varchar(30) not null, -- INBOUND / OUTBOUND / ADJUST
  biz_no varchar(50) not null,
  biz_line_id uuid,
  change_qty numeric(18,3) not null,
  balance_qty numeric(18,3) not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references users(id)
);

create index if not exists idx_inventory_ledger_product_time
  on inventory_ledger(product_id, occurred_at desc);

create table if not exists inventory_balances (
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  on_hand_qty numeric(18,3) not null default 0,
  reserved_qty numeric(18,3) not null default 0,
  available_qty numeric(18,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, product_id)
);

-- 7) finance (phase 2)
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no varchar(50) not null unique,
  customer_id uuid not null references customers(id),
  delivery_order_id uuid references delivery_orders(id),
  invoice_date date not null,
  total_amount numeric(18,2) not null,
  status varchar(30) not null default 'DRAFT',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  request_no varchar(50) not null unique,
  customer_id uuid not null references customers(id),
  invoice_id uuid references invoices(id),
  request_date date not null,
  requested_amount numeric(18,2) not null,
  status varchar(30) not null default 'DRAFT',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no varchar(50) not null unique,
  customer_id uuid not null references customers(id),
  invoice_id uuid references invoices(id),
  received_date date not null,
  amount numeric(18,2) not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- 8) audit & versioning (support "print then edit")
create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  doc_type varchar(30) not null,  -- SALES_ORDER / DELIVERY_ORDER / INVOICE
  doc_id uuid not null,
  version_no int not null,
  snapshot jsonb not null,
  change_reason text,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now(),
  unique (doc_type, doc_id, version_no)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action varchar(50) not null, -- CREATE / UPDATE / PRINT / APPROVE / VOID
  entity_type varchar(50) not null,
  entity_id uuid not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity_time
  on audit_logs(entity_type, entity_id, created_at desc);

-- 9) seed roles
insert into roles(code, name)
values
  ('ADMIN', '管理员'),
  ('OPERATOR', '操作员'),
  ('VIEWER', '只读用户')
on conflict (code) do nothing;
