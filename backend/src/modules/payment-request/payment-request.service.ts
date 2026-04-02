import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';

@Injectable()
export class PaymentRequestService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async create(dto: CreatePaymentRequestDto, companyId: string) {
    await ensureSystemUser(this.dataSource);
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
    return this.findOne((rows[0] as { id: string }).id, companyId);
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

  async update(id: string, dto: UpdatePaymentRequestDto, companyId: string) {
    const current = await this.dataSource.query('select status from payment_requests where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (current.length === 0) {
      throw new NotFoundException('Payment request not found');
    }
    const status = (current[0] as { status: string }).status;
    if (status !== 'DRAFT' && status !== 'REJECTED') {
      throw new BadRequestException('Only DRAFT/REJECTED payment request can be edited');
    }

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
      [id, dto.customerId ?? null, dto.invoiceId ?? null, dto.requestDate ?? null, dto.requestedAmount ?? null, companyId]
    );
    return this.findOne(id, companyId);
  }

  private async transition(id: string, from: string[], to: string, message: string, companyId: string) {
    const result = await this.dataSource.query(
      `
      update payment_requests
      set status = $2, updated_at = now()
      where id = $1 and company_id = $4 and status = any($3::text[])
      returning id
      `,
      [id, to, from, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException(message);
    }
    return this.findOne(id, companyId);
  }

  async submit(id: string, companyId: string) {
    return this.transition(id, ['DRAFT'], 'SUBMITTED', 'Only DRAFT payment request can be submitted', companyId);
  }

  async approve(id: string, companyId: string) {
    return this.transition(id, ['SUBMITTED'], 'APPROVED', 'Only SUBMITTED payment request can be approved', companyId);
  }

  async reject(id: string, companyId: string) {
    return this.transition(id, ['SUBMITTED'], 'REJECTED', 'Only SUBMITTED payment request can be rejected', companyId);
  }

  async close(id: string, companyId: string) {
    return this.transition(id, ['APPROVED', 'REJECTED'], 'CLOSED', 'Only APPROVED/REJECTED payment request can be closed', companyId);
  }
}
