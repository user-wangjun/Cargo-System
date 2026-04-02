import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.supplierService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateSupplierDto) {
    return { code: 0, message: 'ok', data: await this.supplierService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.supplierService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return { code: 0, message: 'ok', data: await this.supplierService.update(id, dto, this.companyId(req)) };
  }
}
