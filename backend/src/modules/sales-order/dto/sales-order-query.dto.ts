import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';

export class SalesOrderQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn([
    'createdAt',
    'orderDate',
    'orderNo',
    'customerName',
    'status',
    'totalAmount',
    'receivedAmount',
    'remainingReceivableAmount',
    'receivedDate',
    'ownerName'
  ])
  sortBy?:
    | 'createdAt'
    | 'orderDate'
    | 'orderNo'
    | 'customerName'
    | 'status'
    | 'totalAmount'
    | 'receivedAmount'
    | 'remainingReceivableAmount'
    | 'receivedDate'
    | 'ownerName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
