import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';

@ApiTags('SalesOrders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }, @Query() query: PageQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.salesOrderService.findAll(query as unknown as Record<string, unknown>, this.companyId(req))
    };
  }

  @Post()
  @RequirePermissions('order.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateSalesOrderDto) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('order.edit')
  async update(
    @Req() req: { user?: { companyId?: string | null } },
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto
  ) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.update(id, dto, this.companyId(req)) };
  }

  @Post(':id/confirm')
  @RequirePermissions('order.approve')
  async confirm(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.confirm(id, this.companyId(req)) };
  }

  @Post(':id/cancel')
  @RequirePermissions('order.approve')
  async cancel(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.cancel(id, this.companyId(req)) };
  }
}
