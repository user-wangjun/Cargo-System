import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        p.id,
        p.product_code as "productCode",
        p.name,
        p.base_unit_id as "baseUnitId",
        u.unit_code as "baseUnitCode",
        p.spec,
        p.color,
        p.is_active as "isActive",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      from products p
      left join units u on u.id = p.base_unit_id
      where p.company_id = $1
      order by p.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateProductDto, companyId: string) {
    const rows = await this.dataSource.query(
      `
      insert into products (product_code, name, base_unit_id, spec, color, is_active, company_id)
      values ($1, $2, $3, $4, $5, true, $6)
      returning id
      `,
      [dto.productCode, dto.name, dto.baseUnitId, dto.spec ?? null, dto.color ?? null, companyId]
    );
    return this.findOne((rows[0] as { id: string }).id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        p.id,
        p.product_code as "productCode",
        p.name,
        p.base_unit_id as "baseUnitId",
        u.unit_code as "baseUnitCode",
        p.spec,
        p.color,
        p.is_active as "isActive",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      from products p
      left join units u on u.id = p.base_unit_id
      where p.id = $1 and p.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Product not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateProductDto, companyId: string) {
    const result = await this.dataSource.query(
      `
      update products
      set
        product_code = coalesce($2, product_code),
        name = coalesce($3, name),
        base_unit_id = coalesce($4, base_unit_id),
        spec = $5,
        color = $6,
        updated_at = now()
      where id = $1 and company_id = $7
      returning id
      `,
      [id, dto.productCode ?? null, dto.name ?? null, dto.baseUnitId ?? null, dto.spec ?? null, dto.color ?? null, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Product not found');
    }
    return this.findOne(id, companyId);
  }
}
