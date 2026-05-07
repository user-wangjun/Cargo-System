import { IsNumber, IsString } from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @IsString()
  warehouseId!: string;

  @IsString()
  productId!: string;

  @IsNumber()
  adjustQty!: number;

  @IsString()
  reason!: string;
}
