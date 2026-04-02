import * as bcrypt from 'bcryptjs';
import { Queryable } from './db-utils';

const DEFAULT_COMPANY_ID = '10000000-0000-0000-0000-000000000001';

const ROLE_CODES = ['ADMIN', 'OWNER', 'SALES', 'WAREHOUSE', 'FINANCE', 'VIEWER'] as const;

const PERMISSION_CODES = [
  ['master.edit', '编辑主数据'],
  ['order.edit', '编辑订单'],
  ['order.approve', '审批订单'],
  ['inventory.edit', '编辑库存'],
  ['finance.edit', '编辑财务单据'],
  ['finance.approve', '审批财务单据'],
  ['user.manage', '管理企业用户']
] as const;

export async function ensureRbacTenantSeed(db: Queryable): Promise<void> {
  await db.query(`
    create table if not exists companies (
      id uuid primary key,
      company_code varchar(50) not null unique,
      name varchar(120) not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`alter table users add column if not exists company_id uuid references companies(id)`);
  await db.query(`alter table users add column if not exists phone varchar(30)`);

  const businessTables = [
    'customers',
    'suppliers',
    'warehouses',
    'units',
    'products',
    'unit_conversions',
    'sales_orders',
    'purchase_receipts',
    'delivery_orders',
    'inventory_ledger',
    'inventory_balances',
    'invoices',
    'payment_requests',
    'receipts',
    'document_versions',
    'audit_logs'
  ];
  for (const tableName of businessTables) {
    await db.query(`alter table ${tableName} add column if not exists company_id uuid references companies(id)`);
    await db.query(`update ${tableName} set company_id = $1 where company_id is null`, [DEFAULT_COMPANY_ID]);
  }

  await db.query(
    `
      insert into companies (id, company_code, name, is_active)
      values ($1, 'DEMO-001', '演示企业', true)
      on conflict (id) do update set name = excluded.name, updated_at = now()
    `,
    [DEFAULT_COMPANY_ID]
  );

  for (const roleCode of ROLE_CODES) {
    await db.query(
      `
        insert into roles(code, name)
        values ($1, $2)
        on conflict (code) do update set name = excluded.name
      `,
      [roleCode, roleCode]
    );
  }

  for (const [code, name] of PERMISSION_CODES) {
    await db.query(
      `
        insert into permissions(code, name)
        values ($1, $2)
        on conflict (code) do update set name = excluded.name
      `,
      [code, name]
    );
  }

  const rolePermissionMap: Record<string, string[]> = {
    ADMIN: PERMISSION_CODES.map((item) => item[0]),
    OWNER: ['master.edit', 'order.edit', 'order.approve', 'inventory.edit', 'finance.edit', 'finance.approve', 'user.manage'],
    SALES: ['order.edit'],
    WAREHOUSE: ['inventory.edit'],
    FINANCE: ['finance.edit', 'finance.approve'],
    VIEWER: []
  };

  for (const [role, permissions] of Object.entries(rolePermissionMap)) {
    for (const permission of permissions) {
      await db.query(
        `
          insert into role_permissions(role_id, permission_id)
          select r.id, p.id
          from roles r
          join permissions p on p.code = $2
          where r.code = $1
          on conflict (role_id, permission_id) do nothing
        `,
        [role, permission]
      );
    }
  }

  const demoUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      password: 'admin123',
      fullName: 'Platform Admin',
      roles: ['ADMIN']
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'owner',
      password: 'owner123',
      fullName: 'Company Owner',
      roles: ['OWNER']
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'finance',
      password: 'finance123',
      fullName: 'Finance Employee',
      roles: ['FINANCE']
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'viewer',
      password: 'viewer123',
      fullName: 'Viewer Employee',
      roles: ['VIEWER']
    }
  ];

  for (const user of demoUsers) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    await db.query(
      `
        insert into users (id, username, password_hash, full_name, is_active, company_id)
        values ($1, $2, $3, $4, true, $5)
        on conflict (id) do update set
          username = excluded.username,
          password_hash = excluded.password_hash,
          full_name = excluded.full_name,
          company_id = excluded.company_id,
          is_active = true,
          updated_at = now()
      `,
      [user.id, user.username, passwordHash, user.fullName, DEFAULT_COMPANY_ID]
    );

    for (const roleCode of user.roles) {
      await db.query(
        `
          insert into user_roles(user_id, role_id)
          select $1, id from roles where code = $2
          on conflict (user_id, role_id) do nothing
        `,
        [user.id, roleCode]
      );
    }
  }
}
