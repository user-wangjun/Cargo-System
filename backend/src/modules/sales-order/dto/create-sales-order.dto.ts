import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class SalesOrderItemDto {
  @IsNumber()
  lineNo!: number;

  @IsString()
  productId!: string;

  @IsNumber()
  orderedQty!: number;

  @IsString()
  unitId!: string;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class CreateSalesOrderDto {
  @IsDateString()
  orderDate!: string;

  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];
}
