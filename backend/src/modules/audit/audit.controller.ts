import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: PageQueryDto) {
    return {
      code: 0,
      message: 'ok',
      data: await this.auditService.findAll(query as unknown as Record<string, unknown>)
    };
  }
}
