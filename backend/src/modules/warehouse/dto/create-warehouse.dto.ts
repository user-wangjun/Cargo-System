import { IsString } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  warehouseCode!: string;

  @IsString()
  name!: string;
}
