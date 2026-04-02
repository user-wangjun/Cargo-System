import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureSystemUser, generateBizNo, SYSTEM_USER_ID } from '../../common/db/db-utils';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async create(dto: CreateInvoiceDto, companyId: string) {
    await ensureSystemUser(this.dataSource);
    const invoiceNo = generateBizNo('INV');
    const rows = await this.dataSource.query(
      `
      insert into invoices (invoice_no, customer_id, delivery_order_id, invoice_date, total_amount, status, created_by, company_id)
      values ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
      returning id
      `,
      [invoiceNo, dto.customerId, dto.deliveryOrderId ?? null, dto.invoiceDate, dto.totalAmount, SYSTEM_USER_ID, companyId]
    );
    return this.findOne((rows[0] as { id: string }).id, companyId);
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

  async update(id: string, dto: UpdateInvoiceDto, companyId: string) {
    const current = await this.dataSource.query('select status from invoices where id = $1 and company_id = $2 limit 1', [id, companyId]);
    if (current.length === 0) {
      throw new NotFoundException('Invoice not found');
    }
    const status = (current[0] as { status: string }).status;
    if (status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoice can be edited');
    }

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
      [id, dto.customerId ?? null, dto.deliveryOrderId ?? null, dto.invoiceDate ?? null, dto.totalAmount ?? null, companyId]
    );
    return this.findOne(id, companyId);
  }

  async issue(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
      update invoices
      set status = 'ISSUED', updated_at = now()
      where id = $1 and company_id = $2 and status = 'DRAFT'
      returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT invoice can be issued');
    }
    return this.findOne(id, companyId);
  }

  async voidDoc(id: string, companyId: string) {
    const result = await this.dataSource.query(
      `
      update invoices
      set status = 'VOID', updated_at = now()
      where id = $1 and company_id = $2 and status in ('DRAFT', 'ISSUED')
      returning id
      `,
      [id, companyId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Only DRAFT/ISSUED invoice can be voided');
    }
    return this.findOne(id, companyId);
  }
}
