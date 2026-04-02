import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ReceiptService } from './receipt.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

@ApiTags('Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.receiptService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('finance.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateReceiptDto) {
    return { code: 0, message: 'ok', data: await this.receiptService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.receiptService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('finance.edit')
  async update(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string, @Body() dto: UpdateReceiptDto) {
    return { code: 0, message: 'ok', data: await this.receiptService.update(id, dto, this.companyId(req)) };
  }
}
