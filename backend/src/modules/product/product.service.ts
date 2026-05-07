import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

type ProductRow = {
  product_code: string;
  name: string;
  base_unit_id: string;
  spec: string | null;
  color: string | null;
  is_active: boolean;
};

@Injectable()
export class ProductService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }

  private async assertBaseUnitExists(baseUnitId: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select id
      from units
      where id = $1 and (company_id = $2 or company_id is null)
      limit 1
      `,
      [baseUnitId, companyId]
    );
    if (rows.length === 0) {
      throw new BadRequestException('Base unit does not exist in current company scope');
    }
  }

  async findAll(query: ProductQueryDto, companyId: string) {
    const params: unknown[] = [companyId];
    const where: string[] = ['p.company_id = $1'];

    if (query.keyword) {
      params.push(`%${String(query.keyword)}%`);
      where.push(`(p.name ilike $${params.length} or p.product_code ilike $${params.length})`);
    }
    if (query.isActive !== undefined) {
      params.push(query.isActive);
      where.push(`p.is_active = $${params.length}`);
    }

    return this.dataSource.query(
      `
      select
        p.id,
        p.product_code as "productCode",
        p.name,
        p.base_unit_id as "baseUnitId",
        u.unit_code as "baseUnitCode",
        u.name as "baseUnitName",
        p.spec,
        p.color,
        p.is_active as "isActive",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      from products p
      left join units u on u.id = p.base_unit_id
      where ${where.join(' and ')}
      order by p.created_at desc
      `,
      params
    );
  }

  async create(dto: CreateProductDto, companyId: string, actorUserId?: string) {
    await this.assertBaseUnitExists(dto.baseUnitId, companyId);

    try {
      const rows = await this.dataSource.query(
        `
        insert into products (product_code, name, base_unit_id, spec, color, is_active, company_id)
        values ($1, $2, $3, $4, $5, coalesce($6, true), $7)
        returning id
        `,
        [dto.productCode, dto.name, dto.baseUnitId, dto.spec ?? null, dto.color ?? null, dto.isActive ?? true, companyId]
      );
      const id = (rows[0] as { id: string }).id;
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'CREATE',
        entityType: 'PRODUCT',
        entityId: id,
        companyId,
        detail: {
          productCode: dto.productCode,
          name: dto.name,
          baseUnitId: dto.baseUnitId,
          isActive: dto.isActive ?? true
        }
      });
      return this.findOne(id, companyId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Product code already exists');
      }
      throw error;
    }
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
        u.name as "baseUnitName",
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

  async update(id: string, dto: UpdateProductDto, companyId: string, actorUserId?: string) {
    const currentRows = await this.dataSource.query(
      'select product_code, name, base_unit_id, spec, color, is_active from products where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (currentRows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    const current = currentRows[0] as ProductRow;
    const nextBaseUnitId = dto.baseUnitId ?? current.base_unit_id;
    await this.assertBaseUnitExists(nextBaseUnitId, companyId);

    const nextState = {
      productCode: dto.productCode ?? current.product_code,
      name: dto.name ?? current.name,
      baseUnitId: nextBaseUnitId,
      spec: dto.spec ?? current.spec,
      color: dto.color ?? current.color,
      isActive: dto.isActive ?? current.is_active
    };

    try {
      const result = await this.dataSource.query(
        `
        update products
        set
          product_code = $2,
          name = $3,
          base_unit_id = $4,
          spec = $5,
          color = $6,
          is_active = $7,
          updated_at = now()
        where id = $1 and company_id = $8
        returning id
        `,
        [
          id,
          nextState.productCode,
          nextState.name,
          nextState.baseUnitId,
          nextState.spec,
          nextState.color,
          nextState.isActive,
          companyId
        ]
      );
      if (result.length === 0) {
        throw new NotFoundException('Product not found');
      }
      await writeAuditLog(this.dataSource, {
        userId: actorUserId,
        action: 'UPDATE',
        entityType: 'PRODUCT',
        entityId: id,
        companyId,
        detail: {
          before: {
            productCode: current.product_code,
            name: current.name,
            baseUnitId: current.base_unit_id,
            spec: current.spec,
            color: current.color,
            isActive: current.is_active
          },
          after: nextState
        }
      });
      return this.findOne(id, companyId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Product code already exists');
      }
      throw error;
    }
  }
}
