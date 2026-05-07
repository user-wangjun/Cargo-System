import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateTo?: string;
}
