import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID, toNumber } from '../../common/db/db-utils';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';

@Injectable()
export class SalesOrderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(query: Record<string, unknown>, companyId: string) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['so.company_id = $1'];
    const params: unknown[] = [companyId];

    if (query.orderNo) {
      params.push(`%${String(query.orderNo)}%`);
      where.push(`so.order_no ilike $${params.length}`);
    }
    if (query.customerId) {
      params.push(String(query.customerId));
      where.push(`so.customer_id = $${params.length}`);
    }
    if (query.status) {
      params.push(String(query.status));
      where.push(`so.status = $${params.length}`);
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const countRows = await this.dataSource.query(`select count(*)::int as total from sales_orders so ${whereSql}`, params);
    const total = (countRows[0] as { total: number })?.total ?? 0;

    params.push(pageSize, offset);
    const rows = await this.dataSource.query(
      `
      select
        so.id,
        so.order_no as "orderNo",
        so.customer_id as "customerId",
        c.name as "customerName",
        so.order_date as "orderDate",
        so.status,
        so.remarks,
        so.created_at as "createdAt",
        so.updated_at as "updatedAt"
      from sales_orders so
      left join customers c on c.id = so.customer_id
      ${whereSql}
      order by so.created_at desc
      limit $${params.length - 1} offset $${params.length}
      `,
      params
    );

    return { list: rows, total, page, pageSize };
  }

  async create(dto: CreateSalesOrderDto, companyId: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await ensureSystemUser(runner);
      const orderNo = generateBizNo('SO');
      const inserted = await runner.query(
        `
          insert into sales_orders (order_no, customer_id, order_date, status, remarks, created_by, company_id)
          values ($1, $2, $3, 'DRAFT', $4, $5, $6)
          returning id
        `,
        [orderNo, dto.customerId, dto.orderDate, dto.remarks ?? null, SYSTEM_USER_ID, companyId]
      );
      const id = (inserted[0] as { id: string }).id;

      for (const item of dto.items) {
        const amount = item.unitPrice ? toNumber(item.orderedQty) * toNumber(item.unitPrice) : null;
        await runner.query(
          `
            insert into sales_order_items
              (sales_order_id, line_no, product_id, ordered_qty, unit_id, unit_price, amount)
            values
              ($1, $2, $3, $4, $5, $6, $7)
          `,
          [id, item.lineNo, item.productId, item.orderedQty, item.unitId, item.unitPrice ?? null, amount]
        );
      }

      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async findOne(id: string, companyId: string) {
    const headers = await this.dataSource.query(
      `
      select
        so.id,
        so.order_no as "orderNo",
        so.customer_id as "customerId",
        c.name as "customerName",
        so.order_date as "orderDate",
        so.status,
        so.remarks,
        so.created_at as "createdAt",
        so.updated_at as "updatedAt"
      from sales_orders so
      left join customers c on c.id = so.customer_id
      where so.id = $1 and so.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (headers.length === 0) {
      throw new NotFoundException('Sales order not found');
    }

    const items = await this.dataSource.query(
      `
      select
        id,
        line_no as "lineNo",
        product_id as "productId",
        ordered_qty as "orderedQty",
        unit_id as "unitId",
        unit_price as "unitPrice",
        amount
      from sales_order_items
      where sales_order_id = $1
      order by line_no asc
      `,
      [id]
    );
    return { ...(headers[0] as Record<string, unknown>), items };
  }

  async update(id: string, dto: UpdateSalesOrderDto, companyId: string) {
    const currentRows = await this.dataSource.query('select status from sales_orders where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (currentRows.length === 0) {
      throw new NotFoundException('Sales order not found');
    }
    const currentStatus = (currentRows[0] as { status: string }).status;
    if (currentStatus !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT sales order can be edited');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `
          update sales_orders
          set
            order_date = coalesce($2, order_date),
            customer_id = coalesce($3, customer_id),
            remarks = $4,
            updated_at = now()
          where id = $1 and company_id = $5
        `,
        [id, dto.orderDate ?? null, dto.customerId ?? null, dto.remarks ?? null, companyId]
      );

      if (dto.items) {
        await runner.query('delete from sales_order_items where sales_order_id = $1', [id]);
        for (const item of dto.items) {
          const amount = item.unitPrice ? toNumber(item.orderedQty) * toNumber(item.unitPrice) : null;
          await runner.query(
            `
              insert into sales_order_items
                (sales_order_id, line_no, product_id, ordered_qty, unit_id, unit_price, amount)
              values
                ($1, $2, $3, $4, $5, $6, $7)
            `,
            [id, item.lineNo, item.productId, item.orderedQty, item.unitId, item.unitPrice ?? null, amount]
          );
        }
      }

      await runner.commitTransaction();
      return this.findOne(id, companyId);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async confirm(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
        update sales_orders
        set status = 'CONFIRMED', updated_at = now()
        where id = $1 and company_id = $2 and status = 'DRAFT'
        returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT sales order can be confirmed');
    }
    return this.findOne(id, companyId);
  }

  async cancel(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
        update sales_orders
        set status = 'CANCELLED', updated_at = now()
        where id = $1 and company_id = $2 and status in ('DRAFT', 'CONFIRMED')
        returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT/CONFIRMED sales order can be cancelled');
    }
    return this.findOne(id, companyId);
  }
}
