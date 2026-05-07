import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../../common/db/audit-log.util';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { assertAllowedStatus } from '../../common/workflow/status-transition';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';

type PaymentRequestRow = {
  customer_id: string;
  invoice_id: string | null;
  status: string;
  requested_amount: number;
};

type LinkedInvoiceRow = {
  customer_id: string;
  status: string;
  total_amount: unknown;
};

@Injectable()
export class PaymentRequestService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async validateInvoiceLink(
    companyId: string,
    customerId: string,
    invoiceId: string | null | undefined,
    requestedAmount?: number
  ) {
    if (!invoiceId) {
      return;
    }

    const rows = await this.dataSource.query(
      `
      select customer_id, status, total_amount
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
      throw new BadRequestException('Payment request customer must match invoice customer');
    }

    assertAllowedStatus('invoice', 'link to payment request', invoice.status, ['ISSUED']);

    if (requestedAmount !== undefined && requestedAmount > Number(invoice.total_amount)) {
      throw new BadRequestException('Requested amount cannot exceed invoice total amount');
    }
  }

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        p.id,
        p.request_no as "requestNo",
        p.customer_id as "customerId",
        c.name as "customerName",
        p.invoice_id as "invoiceId",
        i.invoice_no as "invoiceNo",
        p.request_date as "requestDate",
        p.requested_amount as "requestedAmount",
        p.status,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      from payment_requests p
      left join customers c on c.id = p.customer_id
      left join invoices i on i.id = p.invoice_id
      where p.company_id = $1
      order by p.created_at desc
      `,
      [companyId]
    );
  }

  async create(dto: CreatePaymentRequestDto, companyId: string, actorUserId?: string) {
    await ensureSystemUser(this.dataSource);
    await this.validateInvoiceLink(companyId, dto.customerId, dto.invoiceId ?? null, dto.requestedAmount);

    const requestNo = generateBizNo('PRQ');
    const rows = await this.dataSource.query(
      `
      insert into payment_requests
        (request_no, customer_id, invoice_id, request_date, requested_amount, status, created_by, company_id)
      values
        ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
      returning id
      `,
      [requestNo, dto.customerId, dto.invoiceId ?? null, dto.requestDate, dto.requestedAmount, SYSTEM_USER_ID, companyId]
    );
    const id = (rows[0] as { id: string }).id;
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'PAYMENT_REQUEST',
      entityId: id,
      companyId,
      detail: {
        requestNo,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId ?? null,
        requestedAmount: dto.requestedAmount,
        status: 'DRAFT'
      }
    });
    return this.findOne(id, companyId);
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.dataSource.query(
      `
      select
        p.id,
        p.request_no as "requestNo",
        p.customer_id as "customerId",
        c.name as "customerName",
        p.invoice_id as "invoiceId",
        i.invoice_no as "invoiceNo",
        p.request_date as "requestDate",
        p.requested_amount as "requestedAmount",
        p.status,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      from payment_requests p
      left join customers c on c.id = p.customer_id
      left join invoices i on i.id = p.invoice_id
      where p.id = $1 and p.company_id = $2
      limit 1
      `,
      [id, companyId]
    );
    if (rows.length === 0) {
      throw new NotFoundException('Payment request not found');
    }
    return rows[0];
  }

  async update(id: string, dto: UpdatePaymentRequestDto, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query(
      'select customer_id, invoice_id, status, requested_amount from payment_requests where id = $1 and company_id = $2 limit 1',
      [id, companyId]
    );
    if (current.length === 0) {
      throw new NotFoundException('Payment request not found');
    }

    const currentRow = current[0] as PaymentRequestRow;
    assertAllowedStatus('payment request', 'edit', currentRow.status, ['DRAFT', 'REJECTED']);

    const nextCustomerId = dto.customerId ?? currentRow.customer_id;
    const nextInvoiceId = dto.invoiceId === undefined ? currentRow.invoice_id : (dto.invoiceId ?? null);
    const nextRequestedAmount = dto.requestedAmount ?? currentRow.requested_amount;
    await this.validateInvoiceLink(companyId, nextCustomerId, nextInvoiceId, nextRequestedAmount);

    await this.dataSource.query(
      `
      update payment_requests
      set
        customer_id = coalesce($2, customer_id),
        invoice_id = $3,
        request_date = coalesce($4, request_date),
        requested_amount = coalesce($5, requested_amount),
        status = 'DRAFT',
        updated_at = now()
      where id = $1 and company_id = $6
      `,
      [id, dto.customerId ?? null, nextInvoiceId, dto.requestDate ?? null, dto.requestedAmount ?? null, companyId]
    );
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'PAYMENT_REQUEST',
      entityId: id,
      companyId,
      detail: {
        before: {
          customerId: currentRow.customer_id,
          invoiceId: currentRow.invoice_id,
          requestedAmount: currentRow.requested_amount,
          status: currentRow.status
        },
        after: {
          customerId: nextCustomerId,
          invoiceId: nextInvoiceId,
          requestedAmount: nextRequestedAmount,
          status: 'DRAFT'
        }
      }
    });
    return this.findOne(id, companyId);
  }

  private async transition(id: string, from: string[], to: string, action: string, companyId: string, actorUserId?: string) {
    const current = await this.dataSource.query('select status from payment_requests where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (current.length === 0) {
      throw new NotFoundException('Payment request not found');
    }
    const currentStatus = (current[0] as { status: string }).status;
    assertAllowedStatus('payment request', action, currentStatus, from);

    const result = await this.dataSource.query(
      `
      update payment_requests
      set status = $2, updated_at = now()
      where id = $1 and company_id = $3
      returning id
      `,
      [id, to, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Failed to update payment request status');
    }
    await writeAuditLog(this.dataSource, {
      userId: actorUserId,
      action: 'STATUS_CHANGE',
      entityType: 'PAYMENT_REQUEST',
      entityId: id,
      companyId,
      detail: {
        fromStatus: currentStatus,
        toStatus: to,
        action
      }
    });
    return this.findOne(id, companyId);
  }

  async submit(id: string, companyId: string, actorUserId?: string) {
    return this.transition(id, ['DRAFT'], 'SUBMITTED', 'submit', companyId, actorUserId);
  }

  async approve(id: string, companyId: string, actorUserId?: string) {
    return this.transition(id, ['SUBMITTED'], 'APPROVED', 'approve', companyId, actorUserId);
  }

  async reject(id: string, companyId: string, actorUserId?: string) {
    return this.transition(id, ['SUBMITTED'], 'REJECTED', 'reject', companyId, actorUserId);
  }

  async close(id: string, companyId: string, actorUserId?: string) {
    return this.transition(id, ['APPROVED', 'REJECTED'], 'CLOSED', 'close', companyId, actorUserId);
  }
}
