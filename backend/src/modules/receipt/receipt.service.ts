import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

@Injectable()
export class ReceiptService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async create(dto: CreateReceiptDto, companyId: string) {
    await ensureSystemUser(this.dataSource);
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
    return this.findOne((rows[0] as { id: string }).id, companyId);
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

  async update(id: string, dto: UpdateReceiptDto, companyId: string) {
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
      [id, dto.customerId ?? null, dto.invoiceId ?? null, dto.receivedDate ?? null, dto.amount ?? null, companyId]
    );
    if (result.length === 0) {
      throw new NotFoundException('Receipt not found');
    }
    return this.findOne(id, companyId);
  }
}
