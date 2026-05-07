import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserPermissionsDto } from './dto/update-org-user-permissions.dto';
import { UpdateOrgUserRolesDto } from './dto/update-org-user-roles.dto';
import { OrgService } from './org.service';

type ReqUser = {
  user: {
    sub: string;
    roles?: string[];
    permissions?: string[];
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

  @Get('permissions')
  @RequirePermissions('user.manage')
  async permissions(@Req() req: ReqUser) {
    return { code: 0, message: 'ok', data: await this.orgService.listPermissions(req.user) };
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

  @Patch('users/:id/permissions')
  @RequirePermissions('user.manage')
  async updatePermissions(@Req() req: ReqUser, @Param('id') id: string, @Body() dto: UpdateOrgUserPermissionsDto) {
    return { code: 0, message: 'ok', data: await this.orgService.updateUserPermissions(req.user, id, dto) };
  }
}
