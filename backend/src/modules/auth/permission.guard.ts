import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { ROLES_KEY } from './require-roles.decorator';

type JwtUserPayload = {
  roles?: string[];
  permissions?: string[];
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Missing auth user');
    }

    const roles = user.roles ?? [];
    const permissions = user.permissions ?? [];

    if (roles.includes('ADMIN')) {
      return true;
    }

    if (requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
      throw new ForbiddenException(`Missing roles: ${requiredRoles.join(', ')}`);
    }

    if (requiredPermissions.length > 0) {
      const missing = requiredPermissions.filter((permission) => !permissions.includes(permission));
      if (missing.length > 0) {
        throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
      }
    }
    return true;
  }
}

