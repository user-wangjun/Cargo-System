import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID, toNumber } from '../../common/db/db-utils';

@Injectable()
export class InventoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async balances(query: Record<string, unknown>, companyId: string) {
    const where: string[] = [];
    const params: unknown[] = [companyId];
    where.push(`ib.company_id = $1`);

    if (query.warehouseId) {
      params.push(String(query.warehouseId));
      where.push(`ib.warehouse_id = $${params.length}`);
    }
    if (query.keyword) {
      params.push(`%${String(query.keyword)}%`);
      where.push(`(p.product_code ilike $${params.length} or p.name ilike $${params.length})`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const list = await this.dataSource.query(
      `
      select
        ib.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        ib.product_id as "productId",
        p.product_code as "productCode",
        p.name as "productName",
        p.spec,
        p.color,
        ib.on_hand_qty as "onHandQty",
        ib.reserved_qty as "reservedQty",
        ib.available_qty as "availableQty",
        ib.updated_at as "updatedAt"
      from inventory_balances ib
      left join warehouses w on w.id = ib.warehouse_id
      left join products p on p.id = ib.product_id
      ${whereSql}
      order by ib.updated_at desc
      `,
      params
    );
    return { list };
  }

  async ledger(query: Record<string, unknown>, companyId: string) {
    const where: string[] = [];
    const params: unknown[] = [companyId];
    where.push(`il.company_id = $1`);

    if (query.warehouseId) {
      params.push(String(query.warehouseId));
      where.push(`il.warehouse_id = $${params.length}`);
    }
    if (query.productId) {
      params.push(String(query.productId));
      where.push(`il.product_id = $${params.length}`);
    }
    if (query.bizType) {
      params.push(String(query.bizType));
      where.push(`il.biz_type = $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const list = await this.dataSource.query(
      `
      select
        il.id,
        il.occurred_at as "occurredAt",
        il.warehouse_id as "warehouseId",
        il.product_id as "productId",
        il.biz_type as "bizType",
        il.biz_no as "bizNo",
        il.change_qty as "changeQty",
        il.balance_qty as "balanceQty",
        il.created_by as "createdBy"
      from inventory_ledger il
      ${whereSql}
      order by il.occurred_at desc
      `,
      params
    );
    return { list };
  }

  async adjust(dto: CreateInventoryAdjustmentDto, companyId: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      const rows = await runner.query(
        `
          select on_hand_qty, reserved_qty
          from inventory_balances
          where warehouse_id = $1 and product_id = $2 and company_id = $3
          for update
        `,
        [dto.warehouseId, dto.productId, companyId]
      );

      const currentOnHand = rows.length ? toNumber((rows[0] as { on_hand_qty: unknown }).on_hand_qty) : 0;
      const currentReserved = rows.length ? toNumber((rows[0] as { reserved_qty: unknown }).reserved_qty) : 0;
      const newOnHand = currentOnHand + toNumber(dto.adjustQty);
      if (newOnHand < 0) {
        throw new BadRequestException('Adjustment would make inventory negative');
      }
      const newAvailable = newOnHand - currentReserved;
      const bizNo = generateBizNo('ADJ');

      await runner.query(
        `
          insert into inventory_balances (warehouse_id, product_id, on_hand_qty, reserved_qty, available_qty, updated_at, company_id)
          values ($1, $2, $3, $4, $5, now(), $6)
          on conflict (warehouse_id, product_id)
          do update set
            on_hand_qty = excluded.on_hand_qty,
            reserved_qty = excluded.reserved_qty,
            available_qty = excluded.available_qty,
            updated_at = now()
        `,
        [dto.warehouseId, dto.productId, newOnHand, currentReserved, newAvailable, companyId]
      );

      const insertedLedger = await runner.query(
        `
          insert into inventory_ledger
            (warehouse_id, product_id, biz_type, biz_no, change_qty, balance_qty, created_by, company_id)
          values
            ($1, $2, 'ADJUST', $3, $4, $5, $6, $7)
          returning id, occurred_at
        `,
        [dto.warehouseId, dto.productId, bizNo, dto.adjustQty, newOnHand, SYSTEM_USER_ID, companyId]
      );

      await runner.commitTransaction();
      return {
        id: (insertedLedger[0] as { id: string }).id,
        bizType: 'ADJUST',
        bizNo,
        ...dto,
        balanceQty: newOnHand,
        occurredAt: (insertedLedger[0] as { occurred_at: string }).occurred_at
      };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
