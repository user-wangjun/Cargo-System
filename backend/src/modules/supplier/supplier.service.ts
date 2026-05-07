import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';

type SupplierRow = {
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
};

@Injectable()
export class SupplierService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }

  async findAll(query: SupplierQueryDto, companyId: string) {
    const params: unknown[] = [companyId];
    const where: string[] = ['company_id = $1'];

    if (query.keyword) {
      params.push(`%${String(query.keyword)}%`);
      where.push(`(name ilike $${params.length} or supplier_code ilike $${params.length})`);
    }
    if (query.isActive !== undefined) {
      params.push(query.isActive);
      where.push(`is_active = $${params.length}`);
    }

    return this.dataSource.query(
      `
      select
        id,
        supplier_code as "supplierCode",
        name,
        contact_name as "contactName",
        phone,
        address,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from suppliers
      where ${where.join(' and ')}
      order by created_at desc
      `,
      params
    );
  }

  async create(dto: CreateSupplierDto, companyId: string, actorUserId?: string) {
    try {
      const rows = await this.dataSource.query(
        `
        insert into suppliers (supplier_code, name, contact_name, phone, address, is_active, company_id)
        values ($1, $2, $3, $4, $5, coalesce($6, true), $7)
        returning id
        `,
        [dto.supplierCode, dto.name, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, dto.isActive ?? true, companyId]
      );
      const id = (rows[0] as { id: string }).id;
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'CREATE',
        entityType: 'SUPPLIER',
        entityId: id,
        companyId,
        detail: {
          supplierCode: dto.supplierCode,
          name: dto.name,
          isActive: dto.isActive ?? true
        }
      });
      return this.findOne(id, companyId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Supplier code already exists');
      }
      throw error;
    }
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        id,
        supplier_code as "supplierCode",
        name,
        contact_name as "contactName",
        phone,
        address,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from suppliers
      where id = $1 and company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateSupplierDto, companyId: string, actorUserId?: string) {
    const currentRows = await this.dataSource.query(
      'select supplier_code, name, contact_name, phone, address, is_active from suppliers where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (currentRows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }

    const current = currentRows[0] as SupplierRow;
    const nextState = {
      supplierCode: dto.supplierCode ?? current.supplier_code,
      name: dto.name ?? current.name,
      contactName: dto.contactName ?? current.contact_name,
      phone: dto.phone ?? current.phone,
      address: dto.address ?? current.address,
      isActive: dto.isActive ?? current.is_active
    };

    try {
      const result = await this.dataSource.query(
        `
        update suppliers
        set
          supplier_code = $2,
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
          nextState.supplierCode,
          nextState.name,
          nextState.contactName,
          nextState.phone,
          nextState.address,
          nextState.isActive,
          companyId
        ]
      );
      if (result.length === 0) {
        throw new NotFoundException('Supplier not found');
      }
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'UPDATE',
        entityType: 'SUPPLIER',
        entityId: id,
        companyId,
        detail: {
          before: {
            supplierCode: current.supplier_code,
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
        throw new BadRequestException('Supplier code already exists');
      }
      throw error;
    }
  }
}
