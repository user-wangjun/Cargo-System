import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { assertAllowedStatus } from '../../common/workflow/status-transition';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

type ReceiptRow = {
  customer_id: string;
  invoice_id: string | null;
  amount: number;
};

type LinkedInvoiceRow = {
  customer_id: string;
  status: string;
};

@Injectable()
export class ReceiptService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async validateInvoiceLink(companyId: string, customerId: string, invoiceId?: string | null) {
    if (!invoiceId) {
      return;
    }

    const rows = await this.dataSource.query(
      `
      select customer_id, status
      from invoices
      where id = $1 and company_id = $2
      limit 1
      `,
      [invoiceId, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Linked invoice not found');
    }

    const invoice = rows[0] as LinkedInvoiceRow;
    if (invoice.customer_id !== customerId) {
      throw new BadRequestException('Receipt customer must match invoice customer');
    }

    assertAllowedStatus('invoice', 'link to receipt', invoice.status, ['ISSUED']);
  }

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        r.id,
        r.receipt_no as "receiptNo",
        r.customer_id as "customerId",
        c.name as "customerName",
        r.invoice_id as "invoiceId",
        i.invoice_no as "invoiceNo",
        r.received_date as "receivedDate",
        r.amount,
        r.created_at as "createdAt"
      from receipts r
      left join customers c on c.id = r.customer_id
      left join invoices i on i.id = r.invoice_id
      where r.company_id = $1
      order by r.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreateReceiptDto, companyId: string, actorUserId?: string) {
    await ensureSystemUser(this.dataSource);
    await this.validateInvoiceLink(companyId, dto.customerId, dto.invoiceId ?? null);

    const receiptNo = generateBizNo('RCV');
    const rows = await this.dataSource.query(
      `
      insert into receipts
        (receipt_no, customer_id, invoice_id, received_date, amount, created_by, company_id)
      values
        ($1, $2, $3, $4, $5, $6, $7)
      returning id
      `,
      [receiptNo, dto.customerId, dto.invoiceId ?? null, dto.receivedDate, dto.amount, SYSTEM_USER_ID, companyId]
    );
    const id = (rows[0] as { id: string }).id;
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'RECEIPT',
      entityId: id,
      companyId,
      detail: {
        receiptNo,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId ?? null,
        amount: dto.amount
      }
    });
    return this.findOne(id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        r.id,
        r.receipt_no as "receiptNo",
        r.customer_id as "customerId",
        c.name as "customerName",
        r.invoice_id as "invoiceId",
        i.invoice_no as "invoiceNo",
        r.received_date as "receivedDate",
        r.amount,
        r.created_at as "createdAt"
      from receipts r
      left join customers c on c.id = r.customer_id
      left join invoices i on i.id = r.invoice_id
      where r.id = $1 and r.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Receipt not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdateReceiptDto, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query(
      'select customer_id, invoice_id, amount from receipts where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (current.length === 0) {
      throw new NotFoundException('Receipt not found');
    }

    const currentRow = current[0] as ReceiptRow;
    const nextCustomerId = dto.customerId ?? currentRow.customer_id;
    const nextInvoiceId = dto.invoiceId === undefined ? currentRow.invoice_id : (dto.invoiceId ?? null);
    const nextAmount = dto.amount ?? currentRow.amount;
    await this.validateInvoiceLink(companyId, nextCustomerId, nextInvoiceId);

    const result = await this.dataSource.query(
      `
      update receipts
      set
        customer_id = coalesce($2, customer_id),
        invoice_id = $3,
        received_date = coalesce($4, received_date),
        amount = coalesce($5, amount)
      where id = $1 and company_id = $6
      returning id
      `,
      [id, dto.customerId ?? null, nextInvoiceId, dto.receivedDate ?? null, dto.amount ?? null, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Receipt not found');
    }
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'RECEIPT',
      entityId: id,
      companyId,
      detail: {
        before: {
          customerId: currentRow.customer_id,
          invoiceId: currentRow.invoice_id,
          amount: currentRow.amount
        },
        after: {
          customerId: nextCustomerId,
          invoiceId: nextInvoiceId,
          amount: nextAmount
        }
      }
    });
    return this.findOne(id, companyId);
  }
}
