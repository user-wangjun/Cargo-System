import { Queryable, SYSTEM_USER_ID } from './db-utils';

type AuditLogParams = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  companyId?: string | null;
  detail?: unknown;
};

export async function writeAuditLog(db: Queryable, params: AuditLogParams): Promise<void> {
  await db.query(
    `
      insert into audit_logs (user_id, action, entity_type, entity_id, detail, company_id)
      values ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [
      params.userId ?? SYSTEM_USER_ID,
      params.action,
      params.entityType,
      params.entityId,
      JSON.stringify(params.detail ?? {}),
      params.companyId ?? null
    ]
  );
}
