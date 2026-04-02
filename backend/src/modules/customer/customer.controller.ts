import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }, @Query() query: PageQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.customerService.findAll(query as unknown as Record<string, unknown>, this.companyId(req))
    };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateCustomerDto) {
    return { code: 0, message: 'ok', data: await this.customerService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.customerService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return { code: 0, message: 'ok', data: await this.customerService.update(id, dto, this.companyId(req)) };
  }
}
