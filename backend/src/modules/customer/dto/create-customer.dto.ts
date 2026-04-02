import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  customerCode!: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
