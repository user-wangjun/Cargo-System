import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsDateString()
  receivedDate!: string;

  @IsNumber()
  amount!: number;
}
