import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { PurchaseReceiptService } from './purchase-receipt.service';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { UpdatePurchaseReceiptDto } from './dto/update-purchase-receipt.dto';

@ApiTags('PurchaseReceipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('purchase-receipts')
export class PurchaseReceiptController {
  constructor(private readonly purchaseReceiptService: PurchaseReceiptService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('inventory.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreatePurchaseReceiptDto) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('inventory.edit')
  async update(
    @Req() req: { user?: { companyId?: string | null } },
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseReceiptDto
  ) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.update(id, dto, this.companyId(req)) };
  }

  @Post(':id/post')
  @RequirePermissions('inventory.edit')
  async post(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.post(id, this.companyId(req)) };
  }

  @Post(':id/void')
  @RequirePermissions('inventory.edit')
  async voidDoc(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.purchaseReceiptService.voidDoc(id, this.companyId(req)) };
  }
}
