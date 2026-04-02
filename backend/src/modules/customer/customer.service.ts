import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(query: Record<string, unknown>, companyId: string) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [];
    const where: string[] = ['company_id = $1'];
    params.push(companyId);
    if (query.keyword) {
      params.push(`%${String(query.keyword)}%`);
      where.push(`(name ilike $${params.length} or customer_code ilike $${params.length})`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const countRows = await this.dataSource.query(`select count(*)::int as total from customers ${whereSql}`, params);
    const total = (countRows[0] as { total: number }).total;

    params.push(pageSize, offset);
    const list = await this.dataSource.query(
      `
      select
        id,
        customer_code as "customerCode",
        name,
        contact_name as "contactName",
        phone,
        address,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from customers
      ${whereSql}
      order by created_at desc
      limit $${params.length - 1} offset $${params.length}
      `,
      params
    );
    return { list, total, page, pageSize };
  }

  async create(dto: CreateCustomerDto, companyId: string) {
    const rows = await this.dataSource.query(
      `
      insert into customers (customer_code, name, contact_name, phone, address, is_active, company_id)
      values ($1, $2, $3, $4, $5, coalesce($6, true), $7)
      returning id
      `,
      [dto.customerCode, dto.name, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, dto.isActive ?? true, companyId]
    );
    return this.findOne((rows[0] as { id: string }).id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        id,
        customer_code as "customerCode",
        name,
        contact_name as "contactName",
        phone,
        address,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from customers
      where id = $1 and company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Customer not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateCustomerDto, companyId: string) {
    const result = await this.dataSource.query(
      `
      update customers
      set
        name = coalesce($2, name),
        contact_name = $3,
        phone = $4,
        address = $5,
        is_active = coalesce($6, is_active),
        updated_at = now()
      where id = $1 and company_id = $7
      returning id
      `,
      [id, dto.name ?? null, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, dto.isActive ?? null, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Customer not found');
    }
    return this.findOne(id, companyId);
  }
}
