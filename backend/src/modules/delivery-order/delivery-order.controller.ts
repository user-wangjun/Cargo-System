import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { DeliveryOrderService } from './delivery-order.service';
import { CreateDeliveryOrderDto } from './dto/create-delivery-order.dto';
import { UpdateDeliveryOrderDto } from './dto/update-delivery-order.dto';

@ApiTags('DeliveryOrders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('delivery-orders')
export class DeliveryOrderController {
  constructor(private readonly deliveryOrderService: DeliveryOrderService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('inventory.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateDeliveryOrderDto) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('inventory.edit')
  async update(
    @Req() req: { user?: { companyId?: string | null } },
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryOrderDto
  ) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.update(id, dto, this.companyId(req)) };
  }

  @Post(':id/post')
  @RequirePermissions('inventory.edit')
  async post(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.post(id, this.companyId(req)) };
  }

  @Post(':id/print')
  @RequirePermissions('inventory.edit')
  async print(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.print(id, this.companyId(req)) };
  }

  @Get(':id/versions')
  async versions(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.versions(id, this.companyId(req)) };
  }

  @Post(':id/void')
  @RequirePermissions('inventory.edit')
  async voidDoc(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.deliveryOrderService.voidDoc(id, this.companyId(req)) };
  }
}
