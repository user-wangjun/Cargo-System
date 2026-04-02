import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserRolesDto } from './dto/update-org-user-roles.dto';
import { OrgService } from './org.service';

type ReqUser = {
  user: {
    sub: string;
    roles?: string[];
    companyId?: string | null;
  };
};

@ApiTags('Org')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('roles')
  async roles() {
    return { code: 0, message: 'ok', data: await this.orgService.listRoles() };
  }

  @Get('users')
  @RequirePermissions('user.manage')
  async users(@Req() req: ReqUser) {
    return { code: 0, message: 'ok', data: await this.orgService.listUsers(req.user) };
  }

  @Post('users')
  @RequirePermissions('user.manage')
  async createUser(@Req() req: ReqUser, @Body() dto: CreateOrgUserDto) {
    return { code: 0, message: 'ok', data: await this.orgService.createUser(req.user, dto) };
  }

  @Patch('users/:id/roles')
  @RequirePermissions('user.manage')
  async updateRoles(@Req() req: ReqUser, @Param('id') id: string, @Body() dto: UpdateOrgUserRolesDto) {
    return { code: 0, message: 'ok', data: await this.orgService.updateUserRoles(req.user, id, dto) };
  }
}
