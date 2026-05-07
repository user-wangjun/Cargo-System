import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

type CustomerRow = {
  customer_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
};

@Injectable()
export class CustomerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }

  async findAll(query: CustomerQueryDto, companyId: string) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [companyId];
    const where: string[] = ['company_id = $1'];

    if (query.keyword) {
      params.push(`%${String(query.keyword)}%`);
      where.push(`(name ilike $${params.length} or customer_code ilike $${params.length})`);
    }
    if (query.isActive !== undefined) {
      params.push(query.isActive);
      where.push(`is_active = $${params.length}`);
    }

    const whereSql = `where ${where.join(' and ')}`;
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

  async create(dto: CreateCustomerDto, companyId: string, actorUserId?: string) {
    try {
      const rows = await this.dataSource.query(
        `
        insert into customers (customer_code, name, contact_name, phone, address, is_active, company_id)
        values ($1, $2, $3, $4, $5, coalesce($6, true), $7)
        returning id
        `,
        [dto.customerCode, dto.name, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, dto.isActive ?? true, companyId]
      );
      const id = (rows[0] as { id: string }).id;
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'CREATE',
        entityType: 'CUSTOMER',
        entityId: id,
        companyId,
        detail: {
          customerCode: dto.customerCode,
          name: dto.name,
          isActive: dto.isActive ?? true
        }
      });
      return this.findOne(id, companyId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Customer code already exists');
      }
      throw error;
    }
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

  async update(id: string, dto: UpdateCustomerDto, companyId: string, actorUserId?: string) {
    const currentRows = await this.dataSource.query(
      'select customer_code, name, contact_name, phone, address, is_active from customers where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (currentRows.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const current = currentRows[0] as CustomerRow;
    const nextState = {
      customerCode: dto.customerCode ?? current.customer_code,
      name: dto.name ?? current.name,
      contactName: dto.contactName ?? current.contact_name,
      phone: dto.phone ?? current.phone,
      address: dto.address ?? current.address,
      isActive: dto.isActive ?? current.is_active
    };

    try {
      const result = await this.dataSource.query(
        `
        update customers
        set
          customer_code = $2,
          name = $3,
          contact_name = $4,
          phone = $5,
          address = $6,
          is_active = $7,
          updated_at = now()
        where id = $1 and company_id = $8
        returning id
        `,
        [
          id,
          nextState.customerCode,
          nextState.name,
          nextState.contactName,
          nextState.phone,
          nextState.address,
          nextState.isActive,
          companyId
        ]
      );
      if (result.length === 0) {
        throw new NotFoundException('Customer not found');
      }
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: id,
        companyId,
        detail: {
          before: {
            customerCode: current.customer_code,
            name: current.name,
            contactName: current.contact_name,
            phone: current.phone,
            address: current.address,
            isActive: current.is_active
          },
          after: nextState
        }
      });
      return this.findOne(id, companyId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Customer code already exists');
      }
      throw error;
    }
  }
}
