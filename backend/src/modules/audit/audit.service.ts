import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [];
    const where: string[] = [];
    if (query.entityType) {
      params.push(String(query.entityType));
      where.push(`entity_type = $${params.length}`);
    }
    if (query.entityId) {
      params.push(String(query.entityId));
      where.push(`entity_id = $${params.length}`);
    }
    if (query.action) {
      params.push(String(query.action));
      where.push(`action = $${params.length}`);
    }
    if (query.dateFrom) {
      params.push(String(query.dateFrom));
      where.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (query.dateTo) {
      params.push(String(query.dateTo));
      where.push(`created_at <= $${params.length}::timestamptz`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const countRows = await this.dataSource.query(`select count(*)::int as total from audit_logs ${whereSql}`, params);
    const total = (countRows[0] as { total: number }).total;

    params.push(pageSize, offset);
    const list = await this.dataSource.query(
      `
      select
        id,
        user_id as "userId",
        action,
        entity_type as "entityType",
        entity_id as "entityId",
        detail,
        created_at as "createdAt"
      from audit_logs
      ${whereSql}
      order by created_at desc
      limit $${params.length - 1} offset $${params.length}
      `,
      params
    );

    return { list, total, page, pageSize };
  }
}
