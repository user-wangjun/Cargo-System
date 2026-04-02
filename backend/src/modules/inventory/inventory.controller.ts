import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { InventoryService } from './inventory.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get('balances')
  async balances(@Req() req: { user?: { companyId?: string | null } }, @Query() query: Record<string, unknown>) {
    return { code: 0, message: 'ok', data: await this.inventoryService.balances(query, this.companyId(req)) };
  }

  @Get('ledger')
  async ledger(@Req() req: { user?: { companyId?: string | null } }, @Query() query: Record<string, unknown>) {
    return { code: 0, message: 'ok', data: await this.inventoryService.ledger(query, this.companyId(req)) };
  }

  @Post('adjustments')
  @RequirePermissions('inventory.edit')
  async adjust(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateInventoryAdjustmentDto) {
    return { code: 0, message: 'ok', data: await this.inventoryService.adjust(dto, this.companyId(req)) };
  }
}
