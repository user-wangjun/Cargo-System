import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.invoiceService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('finance.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateInvoiceDto) {
    return { code: 0, message: 'ok', data: await this.invoiceService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.invoiceService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('finance.edit')
  async update(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return { code: 0, message: 'ok', data: await this.invoiceService.update(id, dto, this.companyId(req)) };
  }

  @Post(':id/issue')
  @RequirePermissions('finance.approve')
  async issue(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.invoiceService.issue(id, this.companyId(req)) };
  }

  @Post(':id/void')
  @RequirePermissions('finance.approve')
  async voidDoc(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.invoiceService.voidDoc(id, this.companyId(req)) };
  }
}
