import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { InventoryService } from './inventory.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryBalanceQueryDto } from './dto/inventory-balance-query.dto';
import { InventoryLedgerQueryDto } from './dto/inventory-ledger-query.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get('balances')
  async balances(@Req() req: AuthReq, @Query() query: InventoryBalanceQueryDto) {
    return { code: 0, message: 'ok', data: await this.inventoryService.balances(query, this.companyId(req)) };
  }

  @Get('ledger')
  async ledger(@Req() req: AuthReq, @Query() query: InventoryLedgerQueryDto) {
    return { code: 0, message: 'ok', data: await this.inventoryService.ledger(query, this.companyId(req)) };
  }

  @Post('adjustments')
  @RequirePermissions('inventory.edit')
  async adjust(@Req() req: AuthReq, @Body() dto: CreateInventoryAdjustmentDto) {
    return { code: 0, message: 'ok', data: await this.inventoryService.adjust(dto, this.companyId(req), this.userId(req)) };
  }
}
