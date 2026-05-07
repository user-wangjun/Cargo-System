import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('SalesOrders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  @RequirePermissions('order.view')
  async findAll(@Req() req: AuthReq, @Query() query: SalesOrderQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.salesOrderService.findAll(query, this.companyId(req))
    };
  }

  @Post()
  @RequirePermissions('order.create')
  async create(@Req() req: AuthReq, @Body() dto: CreateSalesOrderDto) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  @RequirePermissions('order.view')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('order.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.update(id, dto, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/confirm')
  @RequirePermissions('order.approve')
  async confirm(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.confirm(id, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/cancel')
  @RequirePermissions('order.approve')
  async cancel(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.salesOrderService.cancel(id, this.companyId(req), this.userId(req)) };
  }
}
