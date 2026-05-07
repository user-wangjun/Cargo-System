import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq, @Query() query: CustomerQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.customerService.findAll(query, this.companyId(req))
    };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: AuthReq, @Body() dto: CreateCustomerDto) {
    return { code: 0, message: 'ok', data: await this.customerService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.customerService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return { code: 0, message: 'ok', data: await this.customerService.update(id, dto, this.companyId(req), this.userId(req)) };
  }
}
