import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

type WarehouseRow = {
  warehouse_code: string;
  name: string;
};

@Injectable()
export class WarehouseService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async assertWarehouseCodeAvailable(warehouseCode: string, companyId: string, excludeId?: string) {
    const rows = await this.dataSource.query(
      `
      select id
      from warehouses
      where lower(warehouse_code) = lower($1)
        and company_id = $2
        and ($3::uuid is null or id <> $3)
      limit 1
      `,
      [warehouseCode, companyId, excludeId ?? null]
    );
    if (rows.length > 0) {
      throw new BadRequestException('Warehouse code already exists');
    }
  }

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        id,
        warehouse_code as "warehouseCode",
        name,
        created_at as "createdAt"
      from warehouses
      where company_id = $1
      order by created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateWarehouseDto, companyId: string, actorUserId?: string) {
    await this.assertWarehouseCodeAvailable(dto.warehouseCode, companyId);

    const rows = await this.dataSource.query(
      `
      insert into warehouses (warehouse_code, name, company_id)
      values ($1, $2, $3)
      returning id
      `,
      [dto.warehouseCode, dto.name, companyId]
    );
    const id = (rows[0] as { id: string }).id;
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'WAREHOUSE',
      entityId: id,
      companyId,
      detail: {
        warehouseCode: dto.warehouseCode,
        name: dto.name
      }
    });
    return this.findOne(id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        id,
        warehouse_code as "warehouseCode",
        name,
        created_at as "createdAt"
      from warehouses
      where id = $1 and company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Warehouse not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateWarehouseDto, companyId: string, actorUserId?: string) {
    const currentRows = await this.dataSource.query(
      `
      select warehouse_code, name
      from warehouses
      where id = $1 and company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (currentRows.length === 0) {
      throw new NotFoundException('Warehouse not found');
    }

    const current = currentRows[0] as WarehouseRow;
    const nextState = {
      warehouseCode: dto.warehouseCode ?? current.warehouse_code,
      name: dto.name ?? current.name
    };

    await this.assertWarehouseCodeAvailable(nextState.warehouseCode, companyId, id);

    const result = await this.dataSource.query(
      `
      update warehouses
      set
        warehouse_code = $2,
        name = $3
      where id = $1 and company_id = $4
      returning id
      `,
      [id, nextState.warehouseCode, nextState.name, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Warehouse not found');
    }

    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'WAREHOUSE',
      entityId: id,
      companyId,
      detail: {
        before: {
          warehouseCode: current.warehouse_code,
          name: current.name
        },
        after: nextState
      }
    });
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId: string, actorUserId?: string) {
    const current = await this.findOne(id, companyId);
    const refs = await this.dataSource.query(
      `
      select
        (select count(*)::int from delivery_orders where warehouse_id = $1 and company_id = $2) as "deliveryOrderCount",
        (select count(*)::int from inventory_balances where warehouse_id = $1 and company_id = $2) as "balanceCount",
        (select count(*)::int from inventory_ledger where warehouse_id = $1 and company_id = $2) as "ledgerCount"
      `,
      [id, companyId]
    );
    const refRow = (refs[0] as {
      deliveryOrderCount: number;
      balanceCount: number;
      ledgerCount: number;
    }) ?? { deliveryOrderCount: 0, balanceCount: 0, ledgerCount: 0 };

    if (refRow.deliveryOrderCount > 0 || refRow.balanceCount > 0 || refRow.ledgerCount > 0) {
      throw new BadRequestException('Warehouse is already referenced by business data and cannot be deleted');
    }

    const result = await this.dataSource.query('delete from warehouses where id = $1 and company_id = $2 returning id', [
      id,
      companyId
    ]);
    if (result.length === 0) {
      throw new NotFoundException('Warehouse not found');
    }

    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'DELETE',
      entityType: 'WAREHOUSE',
      entityId: id,
      companyId,
      detail: current
    });
    return { id };
  }
}
