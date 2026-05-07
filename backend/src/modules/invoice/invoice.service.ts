import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { assertAllowedStatus } from '../../common/workflow/status-transition';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

type InvoiceRow = {
  customer_id: string;
  delivery_order_id: string | null;
  status: string;
  total_amount: unknown;
};

type DeliveryOrderLinkRow = {
  customer_id: string;
  status: string;
};

@Injectable()
export class InvoiceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async validateDeliveryOrderLink(companyId: string, customerId: string, deliveryOrderId?: string | null) {
    if (!deliveryOrderId) {
      return;
    }

    const rows = await this.dataSource.query(
      `
      select customer_id, status
      from delivery_orders
      where id = $1 and company_id = $2
      limit 1
      `,
      [deliveryOrderId, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Linked delivery order not found');
    }

    const deliveryOrder = rows[0] as DeliveryOrderLinkRow;
    if (deliveryOrder.customer_id !== customerId) {
      throw new BadRequestException('Invoice customer must match delivery order customer');
    }

    assertAllowedStatus('delivery order', 'link to invoice', deliveryOrder.status, ['POSTED', 'PRINTED']);
  }

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        i.id,
        i.invoice_no as "invoiceNo",
        i.customer_id as "customerId",
        c.name as "customerName",
        i.delivery_order_id as "deliveryOrderId",
        d.delivery_no as "deliveryNo",
        i.invoice_date as "invoiceDate",
        i.total_amount as "totalAmount",
        i.status,
        i.created_at as "createdAt",
        i.updated_at as "updatedAt"
      from invoices i
      left join customers c on c.id = i.customer_id
      left join delivery_orders d on d.id = i.delivery_order_id
      where i.company_id = $1
      order by i.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateInvoiceDto, companyId: string, actorUserId?: string) {
    await ensureSystemUser(this.dataSource);
    await this.validateDeliveryOrderLink(companyId, dto.customerId, dto.deliveryOrderId ?? null);

    const invoiceNo = generateBizNo('INV');
    const rows = await this.dataSource.query(
      `
      insert into invoices (invoice_no, customer_id, delivery_order_id, invoice_date, total_amount, status, created_by, company_id)
      values ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
      returning id
      `,
      [invoiceNo, dto.customerId, dto.deliveryOrderId ?? null, dto.invoiceDate, dto.totalAmount, SYSTEM_USER_ID, companyId]
    );
    const id = (rows[0] as { id: string }).id;
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: id,
      companyId,
      detail: {
        invoiceNo,
        customerId: dto.customerId,
        deliveryOrderId: dto.deliveryOrderId ?? null,
        totalAmount: dto.totalAmount,
        status: 'DRAFT'
      }
    });
    return this.findOne(id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        i.id,
        i.invoice_no as "invoiceNo",
        i.customer_id as "customerId",
        c.name as "customerName",
        i.delivery_order_id as "deliveryOrderId",
        d.delivery_no as "deliveryNo",
        i.invoice_date as "invoiceDate",
        i.total_amount as "totalAmount",
        i.status,
        i.created_at as "createdAt",
        i.updated_at as "updatedAt"
      from invoices i
      left join customers c on c.id = i.customer_id
      left join delivery_orders d on d.id = i.delivery_order_id
      where i.id = $1 and i.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Invoice not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateInvoiceDto, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query(
      'select customer_id, delivery_order_id, status, total_amount from invoices where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (current.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const currentRow = current[0] as InvoiceRow;
    assertAllowedStatus('invoice', 'edit', currentRow.status, ['DRAFT']);

    const nextCustomerId = dto.customerId ?? currentRow.customer_id;
    const nextDeliveryOrderId = dto.deliveryOrderId === undefined ? currentRow.delivery_order_id : (dto.deliveryOrderId ?? null);
    await this.validateDeliveryOrderLink(companyId, nextCustomerId, nextDeliveryOrderId);

    await this.dataSource.query(
      `
      update invoices
      set
        customer_id = coalesce($2, customer_id),
        delivery_order_id = $3,
        invoice_date = coalesce($4, invoice_date),
        total_amount = coalesce($5, total_amount),
        updated_at = now()
      where id = $1 and company_id = $6
      `,
      [id, dto.customerId ?? null, nextDeliveryOrderId, dto.invoiceDate ?? null, dto.totalAmount ?? null, companyId]
    );
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'INVOICE',
      entityId: id,
      companyId,
      detail: {
        before: {
          customerId: currentRow.customer_id,
          deliveryOrderId: currentRow.delivery_order_id,
          totalAmount: Number(currentRow.total_amount),
          status: currentRow.status
        },
        after: {
          customerId: nextCustomerId,
          deliveryOrderId: nextDeliveryOrderId,
          totalAmount: dto.totalAmount ?? Number(currentRow.total_amount),
          status: currentRow.status
        }
      }
    });
    return this.findOne(id, companyId);
  }

  async issue(id: string, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query(
      'select customer_id, delivery_order_id, status, total_amount from invoices where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (current.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const currentRow = current[0] as InvoiceRow;
    assertAllowedStatus('invoice', 'issue', currentRow.status, ['DRAFT']);

    if (Number(currentRow.total_amount) <= 0) {
      throw new BadRequestException('Invoice total amount must be greater than 0 before issuing');
    }

    await this.validateDeliveryOrderLink(companyId, currentRow.customer_id, currentRow.delivery_order_id);

    const result = await this.dataSource.query(
      `
      update invoices
      set status = 'ISSUED', updated_at = now()
      where id = $1 and company_id = $2
      returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Failed to issue invoice');
    }
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'STATUS_CHANGE',
      entityType: 'INVOICE',
      entityId: id,
      companyId,
      detail: {
        fromStatus: currentRow.status,
        toStatus: 'ISSUED',
        action: 'issue'
      }
    });
    return this.findOne(id, companyId);
  }

  async voidDoc(id: string, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query('select status from invoices where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (current.length === 0) {
      throw new NotFoundException('Invoice not found');
    }
    const status = (current[0] as { status: string }).status;
    assertAllowedStatus('invoice', 'void', status, ['DRAFT', 'ISSUED']);

    const result = await this.dataSource.query(
      `
      update invoices
      set status = 'VOID', updated_at = now()
      where id = $1 and company_id = $2
      returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Failed to void invoice');
    }
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'STATUS_CHANGE',
      entityType: 'INVOICE',
      entityId: id,
      companyId,
      detail: {
        fromStatus: status,
        toStatus: 'VOID',
        action: 'void'
      }
    });
    return this.findOne(id, companyId);
  }
}
