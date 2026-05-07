import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { UnitConversionService } from './unit-conversion.service';

type AuthReq = {
  user?: {
    companyId?: string | null;
  };
};

@ApiTags('UnitConversions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('unit-conversions')
export class UnitConversionController {
  constructor(private readonly unitConversionService: UnitConversionService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq) {
    return { code: 0, message: 'ok', data: await this.unitConversionService.findAll(this.companyId(req)) };
  }
}
