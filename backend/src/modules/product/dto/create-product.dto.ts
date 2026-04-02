import { IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  productCode!: string;

  @IsString()
  name!: string;

  @IsString()
  baseUnitId!: string;

  @IsOptional()
  @IsString()
  spec?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
