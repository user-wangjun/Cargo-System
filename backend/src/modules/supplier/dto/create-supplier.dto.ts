import { IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  supplierCode!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
