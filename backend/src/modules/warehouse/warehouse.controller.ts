import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseService } from './warehouse.service';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq) {
    return { code: 0, message: 'ok', data: await this.warehouseService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: AuthReq, @Body() dto: CreateWarehouseDto) {
    return { code: 0, message: 'ok', data: await this.warehouseService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.warehouseService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return { code: 0, message: 'ok', data: await this.warehouseService.update(id, dto, this.companyId(req), this.userId(req)) };
  }

  @Delete(':id')
  @RequirePermissions('master.edit')
  async remove(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.warehouseService.remove(id, this.companyId(req), this.userId(req)) };
  }
}
