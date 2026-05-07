import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';

export class InventoryLedgerQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  bizType?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateTo?: string;
}
