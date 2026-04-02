import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PurchaseReceiptItemDto {
  @IsNumber()
  lineNo!: number;

  @IsString()
  productId!: string;

  @IsNumber()
  receivedQty!: number;

  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  relatedSalesOrderItemId?: string;
}

export class CreatePurchaseReceiptDto {
  @IsDateString()
  receiptDate!: string;

  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptItemDto)
  items!: PurchaseReceiptItemDto[];
}
