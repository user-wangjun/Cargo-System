import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(companyId: string) {
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
      where company_id = $1
      order by created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateSupplierDto, companyId: string) {
    const rows = await this.dataSource.query(
      `
      insert into suppliers (supplier_code, name, contact_name, phone, address, is_active, company_id)
      values ($1, $2, $3, $4, $5, true, $6)
      returning id
      `,
      [dto.supplierCode, dto.name, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, companyId]
    );
    return this.findOne((rows[0] as { id: string }).id, companyId);
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

  async update(id: string, dto: UpdateSupplierDto, companyId: string) {
    const result = await this.dataSource.query(
      `
      update suppliers
      set
        name = coalesce($2, name),
        contact_name = $3,
        phone = $4,
        address = $5,
        updated_at = now()
      where id = $1 and company_id = $6
      returning id
      `,
      [id, dto.name ?? null, dto.contactName ?? null, dto.phone ?? null, dto.address ?? null, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Supplier not found');
    }
    return this.findOne(id, companyId);
  }
}
