import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ensureSystemUser,
  generateBizNo,
  getConvertedBaseQty,
  SYSTEM_USER_ID,
  toNumber
} from '../../common/db/db-utils';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { UpdatePurchaseReceiptDto } from './dto/update-purchase-receipt.dto';

@Injectable()
export class PurchaseReceiptService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        pr.id,
        pr.receipt_no as "receiptNo",
        pr.supplier_id as "supplierId",
        s.name as "supplierName",
        pr.receipt_date as "receiptDate",
        pr.status,
        pr.remarks,
        pr.created_at as "createdAt",
        pr.updated_at as "updatedAt"
      from purchase_receipts pr
      left join suppliers s on s.id = pr.supplier_id
      where pr.company_id = $1
      order by pr.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreatePurchaseReceiptDto, companyId: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      const receiptNo = generateBizNo('PR');
      const inserted = await runner.query(
        `
          insert into purchase_receipts (receipt_no, supplier_id, receipt_date, status, remarks, created_by, company_id)
          values ($1, $2, $3, 'DRAFT', $4, $5, $6)
          returning id
        `,
        [receiptNo, dto.supplierId, dto.receiptDate, dto.remarks ?? null, SYSTEM_USER_ID, companyId]
      );
      const id = (inserted[0] as { id: string }).id;

      for (const item of dto.items) {
        const convertedBaseQty = await getConvertedBaseQty(runner, item.productId, item.unitId, item.receivedQty);
        await runner.query(
          `
            insert into purchase_receipt_items
              (purchase_receipt_id, line_no, product_id, received_qty, unit_id, converted_base_qty, related_sales_order_item_id)
            values
              ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            id,
            item.lineNo,
            item.productId,
            item.receivedQty,
            item.unitId,
            convertedBaseQty,
            item.relatedSalesOrderItemId ?? null
          ]
        );
      }

      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  async findOne(id: string, companyId: string) {
    const headers = await this.dataSource.query(
      `
      select
        pr.id,
        pr.receipt_no as "receiptNo",
        pr.supplier_id as "supplierId",
        s.name as "supplierName",
        pr.receipt_date as "receiptDate",
        pr.status,
        pr.remarks,
        pr.created_at as "createdAt",
        pr.updated_at as "updatedAt"
      from purchase_receipts pr
      left join suppliers s on s.id = pr.supplier_id
      where pr.id = $1 and pr.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (headers.length === 0) {
      throw new NotFoundException('Purchase receipt not found');
    }

    const items = await this.dataSource.query(
      `
      select
        id,
        line_no as "lineNo",
        product_id as "productId",
        received_qty as "receivedQty",
        unit_id as "unitId",
        converted_base_qty as "convertedBaseQty",
        related_sales_order_item_id as "relatedSalesOrderItemId"
      from purchase_receipt_items
      where purchase_receipt_id = $1
      order by line_no asc
      `,
      [id]
    );
    return { ...(headers[0] as Record<string, unknown>), items };
  }

  async update(id: string, dto: UpdatePurchaseReceiptDto, companyId: string) {
    const currentRows = await this.dataSource.query('select status from purchase_receipts where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (currentRows.length === 0) {
      throw new NotFoundException('Purchase receipt not found');
    }
    const currentStatus = (currentRows[0] as { status: string }).status;
    if (currentStatus !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT purchase receipt can be edited');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `
          update purchase_receipts
          set
            receipt_date = coalesce($2, receipt_date),
            supplier_id = coalesce($3, supplier_id),
            remarks = $4,
            updated_at = now()
          where id = $1 and company_id = $5
        `,
        [id, dto.receiptDate ?? null, dto.supplierId ?? null, dto.remarks ?? null, companyId]
      );

      if (dto.items) {
        await runner.query('delete from purchase_receipt_items where purchase_receipt_id = $1', [id]);
        for (const item of dto.items) {
          const convertedBaseQty = await getConvertedBaseQty(runner, item.productId, item.unitId, item.receivedQty);
          await runner.query(
            `
              insert into purchase_receipt_items
                (purchase_receipt_id, line_no, product_id, received_qty, unit_id, converted_base_qty, related_sales_order_item_id)
              values
                ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              id,
              item.lineNo,
              item.productId,
              item.receivedQty,
              item.unitId,
              convertedBaseQty,
              item.relatedSalesOrderItemId ?? null
            ]
          );
        }
      }

      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  async post(id: string, companyId: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      const headerRows = await runner.query(
        'select receipt_no, status from purchase_receipts where id = $1 and company_id = $2 for update',
        [id, companyId]
      );
      if (headerRows.length === 0) {
        throw new NotFoundException('Purchase receipt not found');
      }
      const header = headerRows[0] as { receipt_no: string; status: string };
      if (header.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT purchase receipt can be posted');
      }

      const whRows = await runner.query('select id from warehouses where company_id = $1 order by created_at asc limit 1', [companyId]);
      if (whRows.length === 0) {
        throw new BadRequestException('At least one warehouse is required before posting receipt');
      }
      const warehouseId = (whRows[0] as { id: string }).id;

      const items = await runner.query(
        `
        select id, product_id, converted_base_qty
        from purchase_receipt_items
        where purchase_receipt_id = $1
        order by line_no asc
        `,
        [id]
      );
      if (items.length === 0) {
        throw new BadRequestException('Cannot post empty purchase receipt');
      }

      for (const item of items as Array<{ id: string; product_id: string; converted_base_qty: unknown }>) {
        const changeQty = toNumber(item.converted_base_qty);
        const balanceRows = await runner.query(
          `
            select on_hand_qty, reserved_qty
            from inventory_balances
            where warehouse_id = $1 and product_id = $2 and company_id = $3
            for update
          `,
          [warehouseId, item.product_id, companyId]
        );

        const currentOnHand = balanceRows.length ? toNumber((balanceRows[0] as { on_hand_qty: unknown }).on_hand_qty) : 0;
        const currentReserved = balanceRows.length ? toNumber((balanceRows[0] as { reserved_qty: unknown }).reserved_qty) : 0;
        const newOnHand = currentOnHand + changeQty;
        const newAvailable = newOnHand - currentReserved;

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
          [warehouseId, item.product_id, newOnHand, currentReserved, newAvailable, companyId]
        );

        await runner.query(
          `
            insert into inventory_ledger
              (warehouse_id, product_id, biz_type, biz_no, biz_line_id, change_qty, balance_qty, created_by, company_id)
            values
              ($1, $2, 'INBOUND', $3, $4, $5, $6, $7, $8)
          `,
          [warehouseId, item.product_id, header.receipt_no, item.id, changeQty, newOnHand, SYSTEM_USER_ID, companyId]
        );
      }

      await runner.query(`update purchase_receipts set status = 'POSTED', updated_at = now() where id = $1 and company_id = $2`, [id, companyId]);
      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async voidDoc(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
        update purchase_receipts
        set status = 'VOID', updated_at = now()
        where id = $1 and company_id = $2 and status = 'DRAFT'
        returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT purchase receipt can be voided');
    }
    return this.findOne(id, companyId);
  }
}
