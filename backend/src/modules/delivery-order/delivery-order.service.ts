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
import { CreateDeliveryOrderDto } from './dto/create-delivery-order.dto';
import { UpdateDeliveryOrderDto } from './dto/update-delivery-order.dto';

@Injectable()
export class DeliveryOrderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        d.id,
        d.delivery_no as "deliveryNo",
        d.customer_id as "customerId",
        c.name as "customerName",
        d.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        d.delivery_date as "deliveryDate",
        d.status,
        d.printed_at as "printedAt",
        d.remarks,
        d.created_at as "createdAt",
        d.updated_at as "updatedAt"
      from delivery_orders d
      left join customers c on c.id = d.customer_id
      left join warehouses w on w.id = d.warehouse_id
      where d.company_id = $1
      order by d.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateDeliveryOrderDto, companyId: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      const deliveryNo = generateBizNo('DO');
      const inserted = await runner.query(
        `
          insert into delivery_orders
            (delivery_no, customer_id, warehouse_id, delivery_date, status, remarks, created_by, company_id)
          values
            ($1, $2, $3, $4, 'DRAFT', $5, $6, $7)
          returning id
        `,
        [deliveryNo, dto.customerId, dto.warehouseId, dto.deliveryDate, dto.remarks ?? null, SYSTEM_USER_ID, companyId]
      );
      const id = (inserted[0] as { id: string }).id;

      for (const item of dto.items) {
        const convertedBaseQty = await getConvertedBaseQty(runner, item.productId, item.unitId, item.deliveredQty);
        await runner.query(
          `
            insert into delivery_order_items
              (delivery_order_id, line_no, product_id, delivered_qty, unit_id, converted_base_qty, related_sales_order_item_id)
            values
              ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            id,
            item.lineNo,
            item.productId,
            item.deliveredQty,
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
        d.id,
        d.delivery_no as "deliveryNo",
        d.customer_id as "customerId",
        c.name as "customerName",
        d.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        d.delivery_date as "deliveryDate",
        d.status,
        d.printed_at as "printedAt",
        d.remarks,
        d.created_at as "createdAt",
        d.updated_at as "updatedAt"
      from delivery_orders d
      left join customers c on c.id = d.customer_id
      left join warehouses w on w.id = d.warehouse_id
      where d.id = $1 and d.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (headers.length === 0) {
      throw new NotFoundException('Delivery order not found');
    }

    const items = await this.dataSource.query(
      `
      select
        id,
        line_no as "lineNo",
        product_id as "productId",
        delivered_qty as "deliveredQty",
        unit_id as "unitId",
        converted_base_qty as "convertedBaseQty",
        related_sales_order_item_id as "relatedSalesOrderItemId"
      from delivery_order_items
      where delivery_order_id = $1
      order by line_no asc
      `,
      [id]
    );
    return { ...(headers[0] as Record<string, unknown>), items };
  }

  async update(id: string, dto: UpdateDeliveryOrderDto, companyId: string) {
    const currentRows = await this.dataSource.query(
      `
      select id, status
      from delivery_orders
      where id = $1 and company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (currentRows.length === 0) {
      throw new NotFoundException('Delivery order not found');
    }
    const currentStatus = (currentRows[0] as { status: string }).status;
    if (!['DRAFT', 'PRINTED', 'UPDATED_AFTER_PRINT'].includes(currentStatus)) {
      throw new BadRequestException('Only DRAFT/PRINTED/UPDATED_AFTER_PRINT delivery order can be edited');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      if (currentStatus === 'PRINTED' || currentStatus === 'UPDATED_AFTER_PRINT') {
        const snapshot = await this.findOne(id, companyId);
        const versionRows = await runner.query(
          `
            select coalesce(max(version_no), 0)::int as max_version
            from document_versions
            where doc_type = 'DELIVERY_ORDER' and doc_id = $1
          `,
          [id]
        );
        const nextVersion = ((versionRows[0] as { max_version: number }).max_version ?? 0) + 1;
        await runner.query(
          `
            insert into document_versions
              (doc_type, doc_id, version_no, snapshot, change_reason, changed_by, company_id)
            values
              ('DELIVERY_ORDER', $1, $2, $3::jsonb, $4, $5, $6)
          `,
          [id, nextVersion, JSON.stringify(snapshot), 'Edited after print', SYSTEM_USER_ID, companyId]
        );
      }

      const nextStatus = currentStatus === 'DRAFT' ? 'DRAFT' : 'UPDATED_AFTER_PRINT';
      await runner.query(
        `
          update delivery_orders
          set
            delivery_date = coalesce($2, delivery_date),
            customer_id = coalesce($3, customer_id),
            warehouse_id = coalesce($4, warehouse_id),
            remarks = $5,
            status = $6,
            updated_at = now()
          where id = $1 and company_id = $7
        `,
        [id, dto.deliveryDate ?? null, dto.customerId ?? null, dto.warehouseId ?? null, dto.remarks ?? null, nextStatus, companyId]
      );

      if (dto.items) {
        await runner.query('delete from delivery_order_items where delivery_order_id = $1', [id]);
        for (const item of dto.items) {
          const convertedBaseQty = await getConvertedBaseQty(runner, item.productId, item.unitId, item.deliveredQty);
          await runner.query(
            `
              insert into delivery_order_items
                (delivery_order_id, line_no, product_id, delivered_qty, unit_id, converted_base_qty, related_sales_order_item_id)
              values
                ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              id,
              item.lineNo,
              item.productId,
              item.deliveredQty,
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
        `
        select delivery_no, warehouse_id, status
        from delivery_orders
        where id = $1 and company_id = $2
        for update
        `,
        [id, companyId]
      );
      if (headerRows.length === 0) {
        throw new NotFoundException('Delivery order not found');
      }
      const header = headerRows[0] as { delivery_no: string; warehouse_id: string; status: string };
      if (header.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT delivery order can be posted');
      }

      const items = await runner.query(
        `
        select id, product_id, converted_base_qty
        from delivery_order_items
        where delivery_order_id = $1
        order by line_no asc
        `,
        [id]
      );
      if (items.length === 0) {
        throw new BadRequestException('Cannot post empty delivery order');
      }

      for (const item of items as Array<{ id: string; product_id: string; converted_base_qty: unknown }>) {
        const outboundQty = toNumber(item.converted_base_qty);
        const balanceRows = await runner.query(
          `
          select on_hand_qty, reserved_qty
          from inventory_balances
          where warehouse_id = $1 and product_id = $2 and company_id = $3
          for update
          `,
          [header.warehouse_id, item.product_id, companyId]
        );
        if (balanceRows.length === 0) {
          throw new BadRequestException(`Insufficient inventory for product ${item.product_id}`);
        }

        const currentOnHand = toNumber((balanceRows[0] as { on_hand_qty: unknown }).on_hand_qty);
        const currentReserved = toNumber((balanceRows[0] as { reserved_qty: unknown }).reserved_qty);
        if (currentOnHand < outboundQty) {
          throw new BadRequestException(`Insufficient inventory for product ${item.product_id}`);
        }
        const newOnHand = currentOnHand - outboundQty;
        const newAvailable = newOnHand - currentReserved;

        await runner.query(
          `
          update inventory_balances
          set
            on_hand_qty = $3,
            available_qty = $4,
            updated_at = now()
          where warehouse_id = $1 and product_id = $2 and company_id = $5
          `,
          [header.warehouse_id, item.product_id, newOnHand, newAvailable, companyId]
        );

        await runner.query(
          `
          insert into inventory_ledger
            (warehouse_id, product_id, biz_type, biz_no, biz_line_id, change_qty, balance_qty, created_by, company_id)
          values
            ($1, $2, 'OUTBOUND', $3, $4, $5, $6, $7, $8)
          `,
          [header.warehouse_id, item.product_id, header.delivery_no, item.id, -outboundQty, newOnHand, SYSTEM_USER_ID, companyId]
        );
      }

      await runner.query(`update delivery_orders set status = 'POSTED', updated_at = now() where id = $1 and company_id = $2`, [id, companyId]);
      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async print(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
        update delivery_orders
        set status = 'PRINTED', printed_at = now(), updated_at = now()
        where id = $1 and company_id = $2 and status in ('POSTED', 'UPDATED_AFTER_PRINT')
        returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only POSTED/UPDATED_AFTER_PRINT delivery order can be printed');
    }
    return this.findOne(id, companyId);
  }

  async versions(id: string, companyId: string) {
    return this.dataSource.query(
      `
      select
        version_no as "versionNo",
        snapshot,
        change_reason as "changeReason",
        changed_by as "changedBy",
        changed_at as "changedAt"
      from document_versions
      where doc_type = 'DELIVERY_ORDER' and doc_id = $1 and company_id = $2
      order by version_no desc
      `,
      [id, companyId]
    );
  }

  async voidDoc(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
        update delivery_orders
        set status = 'VOID', updated_at = now()
        where id = $1 and company_id = $2 and status in ('DRAFT', 'POSTED')
        returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT/POSTED delivery order can be voided');
    }
    return this.findOne(id, companyId);
  }
}
