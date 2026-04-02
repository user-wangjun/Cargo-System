export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface Queryable {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
}

export function generateBizNo(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${y}${m}${d}${h}${mm}${s}${rand}`;
}

export async function ensureSystemUser(db: Queryable): Promise<void> {
  await db.query(
    `
      insert into users (id, username, password_hash, full_name, is_active)
      values ($1, 'admin', 'mock-hash', 'System Admin', true)
      on conflict (id) do nothing
    `,
    [SYSTEM_USER_ID]
  );
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    return 0;
  }
  return n;
}

export async function getConvertedBaseQty(
  db: Queryable,
  productId: string,
  unitId: string,
  qty: number
): Promise<number> {
  const products = await db.query('select base_unit_id from products where id = $1', [productId]);
  if (products.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }

  const baseUnitId = (products[0] as { base_unit_id: string }).base_unit_id;
  if (baseUnitId === unitId) {
    return qty;
  }

  const conversions = await db.query(
    `
      select factor
      from unit_conversions
      where product_id = $1 and from_unit_id = $2 and to_unit_id = $3
      limit 1
    `,
    [productId, unitId, baseUnitId]
  );
  if (conversions.length === 0) {
    throw new Error(`Missing unit conversion for product ${productId}`);
  }

  const factor = toNumber((conversions[0] as { factor: unknown }).factor);
  return qty * factor;
}
