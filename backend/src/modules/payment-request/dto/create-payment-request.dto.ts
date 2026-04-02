import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentRequestDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsDateString()
  requestDate!: string;

  @IsNumber()
  requestedAmount!: number;
}
