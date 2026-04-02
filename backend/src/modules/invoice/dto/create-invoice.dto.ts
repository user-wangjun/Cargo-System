import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  deliveryOrderId?: string;

  @IsDateString()
  invoiceDate!: string;

  @IsNumber()
  totalAmount!: number;
}
