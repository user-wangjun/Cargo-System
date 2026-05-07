import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditQueryDto } from './dto/audit-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';

type ReqUser = {
  user: {
    roles?: string[];
    companyId?: string | null;
  };
};

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('user.manage')
  async findAll(@Req() req: ReqUser, @Query() query: AuditQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.auditService.findAll(query, req.user)
    };
  }
}
