import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ReceiptService } from './receipt.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq) {
    return { code: 0, message: 'ok', data: await this.receiptService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('finance.edit')
  async create(@Req() req: AuthReq, @Body() dto: CreateReceiptDto) {
    return { code: 0, message: 'ok', data: await this.receiptService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.receiptService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('finance.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdateReceiptDto) {
    return { code: 0, message: 'ok', data: await this.receiptService.update(id, dto, this.companyId(req), this.userId(req)) };
  }
}
