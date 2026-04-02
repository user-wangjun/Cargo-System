import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class DeliveryOrderItemDto {
  @IsNumber()
  lineNo!: number;

  @IsString()
  productId!: string;

  @IsNumber()
  deliveredQty!: number;

  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  relatedSalesOrderItemId?: string;
}

export class CreateDeliveryOrderDto {
  @IsDateString()
  deliveryDate!: string;

  @IsString()
  customerId!: string;

  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryOrderItemDto)
  items!: DeliveryOrderItemDto[];
}
