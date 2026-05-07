import * as bcrypt from 'bcryptjs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureRbacTenantSeed } from '../../common/db/rbac-tenant-seed';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserPermissionsDto } from './dto/update-org-user-permissions.dto';
import { UpdateOrgUserRolesDto } from './dto/update-org-user-roles.dto';

type JwtUserPayload = {
  sub: string;
  roles?: string[];
  permissions?: string[];
  companyId?: string | null;
};

type PgUniqueViolation = {
  code?: string;
  constraint?: string;
  message?: string;
};

@Injectable()
export class OrgService {
  private seedPromise?: Promise<void>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async ensureSeeded() {
    if (!this.seedPromise) {
      this.seedPromise = ensureRbacTenantSeed(this.dataSource);
    }
    await this.seedPromise;
  }

  private isAdmin(user: JwtUserPayload): boolean {
    return (user.roles ?? []).includes('ADMIN');
  }

  private assertCompanyScope(user: JwtUserPayload) {
    if (!this.isAdmin(user) && !user.companyId) {
      throw new ForbiddenException('Current user is not bound to a company');
    }
  }

  private isUniqueViolation(error: unknown): error is PgUniqueViolation {
    return typeof error === 'object' && error !== null && 'code' in error && (error as PgUniqueViolation).code === '23505';
  }

  async listRoles() {
    await this.ensureSeeded();
    return this.dataSource.query('select code, name from roles order by code asc');
  }

  async listPermissions(currentUser: JwtUserPayload) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    const rows = await this.dataSource.query('select code, name from permissions order by code asc');
    if (this.isAdmin(currentUser)) {
      return rows.map((item: { code: string; name: string }) => ({ ...item, assignable: true }));
    }

    const assignable = await this.getActorPermissionSet(currentUser);
    return rows.map((item: { code: string; name: string }) => ({
      ...item,
      assignable: assignable.has(item.code)
    }));
  }

  async listUsers(currentUser: JwtUserPayload) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    const where = this.isAdmin(currentUser) ? 'true' : 'u.company_id = $1';
    const params = this.isAdmin(currentUser) ? [] : [currentUser.companyId];

    return this.dataSource.query(
      this.buildUserQuery(where, 'order by u.created_at desc'),
      params
    );
  }

  async createUser(currentUser: JwtUserPayload, dto: CreateOrgUserDto) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    const companyId = currentUser.companyId ?? null;
    const roleCodes = this.normalizeCodes(dto.roleCodes);
    const permissionCodes = this.normalizeCodes(dto.permissionCodes);
    const finalRoleCodes = roleCodes.length > 0 ? roleCodes : ['VIEWER'];
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    await this.assertRoleDelegationAllowed(currentUser, finalRoleCodes);
    await this.assertPermissionDelegationAllowed(currentUser, permissionCodes);

    try {
      const rows = await this.dataSource.query(
        `
          insert into users (username, password_hash, full_name, is_active, company_id, phone)
          values ($1, $2, $3, true, $4, $5)
          returning id
        `,
        [dto.username, passwordHash, dto.fullName, companyId, dto.phone ?? null]
      );
      const userId = (rows[0] as { id: string }).id;
      await this.replaceUserRolesWithScope(currentUser, userId, finalRoleCodes);
      await this.replaceUserPermissionsWithScope(currentUser, userId, permissionCodes);
      return this.getUserDetailWithScope(currentUser, userId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const hint = `${error.constraint ?? ''} ${error.message ?? ''}`;
        if (/users_username_key/i.test(hint)) {
          throw new BadRequestException('Username already exists');
        }
        if (/users_phone_unique_idx|users_phone_key/i.test(hint)) {
          throw new BadRequestException('Phone already exists');
        }
      }
      if (error instanceof Error && /users_username_key/i.test(error.message)) {
        throw new BadRequestException('Username already exists');
      }
      if (error instanceof Error && /users_phone_unique_idx|users_phone_key/i.test(error.message)) {
        throw new BadRequestException('Phone already exists');
      }
      throw error;
    }
  }

  async updateUserRoles(currentUser: JwtUserPayload, userId: string, dto: UpdateOrgUserRolesDto) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    await this.replaceUserRolesWithScope(currentUser, userId, this.normalizeCodes(dto.roleCodes));
    return this.getUserDetailWithScope(currentUser, userId);
  }

  async updateUserPermissions(currentUser: JwtUserPayload, userId: string, dto: UpdateOrgUserPermissionsDto) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    await this.replaceUserPermissionsWithScope(currentUser, userId, this.normalizeCodes(dto.permissionCodes));
    return this.getUserDetailWithScope(currentUser, userId);
  }

  private async getUserDetailWithScope(currentUser: JwtUserPayload, userId: string) {
    const where = this.isAdmin(currentUser) ? 'u.id = $1' : 'u.id = $1 and u.company_id = $2';
    const params = this.isAdmin(currentUser) ? [userId] : [userId, currentUser.companyId];
    const rows = await this.dataSource.query(
      this.buildUserQuery(where, 'limit 1'),
      params
    );
    if (rows.length === 0) {
      throw new NotFoundException('User not found in current company scope');
    }
    return rows[0];
  }

  private async replaceUserRolesWithScope(currentUser: JwtUserPayload, userId: string, roleCodes: string[]) {
    await this.assertTargetUserWithinScope(currentUser, userId);
    await this.assertRoleDelegationAllowed(currentUser, roleCodes);

    await this.dataSource.query('delete from user_roles where user_id = $1', [userId]);
    for (const roleCode of roleCodes) {
      const inserted = await this.dataSource.query(
        `
          insert into user_roles (user_id, role_id)
          select $1, id
          from roles
          where code = $2
          on conflict (user_id, role_id) do nothing
          returning user_id
        `,
        [userId, roleCode]
      );
      if (inserted.length === 0) {
        const roleRows = await this.dataSource.query('select id from roles where code = $1 limit 1', [roleCode]);
        if (roleRows.length === 0) {
          throw new BadRequestException(`Unknown role code: ${roleCode}`);
        }
      }
    }
  }

  private async replaceUserPermissionsWithScope(currentUser: JwtUserPayload, userId: string, permissionCodes: string[]) {
    await this.assertTargetUserWithinScope(currentUser, userId);
    await this.assertPermissionDelegationAllowed(currentUser, permissionCodes);

    await this.dataSource.query('delete from user_permissions where user_id = $1', [userId]);
    for (const permissionCode of permissionCodes) {
      await this.dataSource.query(
        `
          insert into user_permissions (user_id, permission_id, granted_by)
          select $1, p.id, $3
          from permissions p
          where p.code = $2
          on conflict (user_id, permission_id) do update set
            granted_by = excluded.granted_by,
            updated_at = now()
        `,
        [userId, permissionCode, currentUser.sub]
      );
    }
  }

  private buildUserQuery(whereClause: string, tailSql = '') {
    return `
      select
        u.id,
        u.username,
        u.full_name as "fullName",
        u.phone,
        u.is_active as "isActive",
        u.company_id as "companyId",
        c.name as "companyName",
        coalesce(
          (
            select array_agg(distinct r.code order by r.code)
            from user_roles ur
            join roles r on r.id = ur.role_id
            where ur.user_id = u.id
          ),
          '{}'
        ) as roles,
        coalesce(
          (
            select array_agg(distinct p.code order by p.code)
            from user_permissions up
            join permissions p on p.id = up.permission_id
            where up.user_id = u.id
          ),
          '{}'
        ) as "directPermissions",
        coalesce(
          (
            select array_agg(distinct x.code order by x.code)
            from (
              select p.code
              from user_roles ur
              join role_permissions rp on rp.role_id = ur.role_id
              join permissions p on p.id = rp.permission_id
              where ur.user_id = u.id
              union
              select p.code
              from user_permissions up
              join permissions p on p.id = up.permission_id
              where up.user_id = u.id
            ) x
          ),
          '{}'
        ) as permissions
      from users u
      left join companies c on c.id = u.company_id
      where ${whereClause}
      ${tailSql}
    `;
  }

  private normalizeCodes(codes?: string[]) {
    return Array.from(
      new Set(
        (codes ?? [])
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
      )
    );
  }

  private async assertTargetUserWithinScope(currentUser: JwtUserPayload, userId: string) {
    const targetRows = await this.dataSource.query('select id, company_id from users where id = $1 limit 1', [userId]);
    if (targetRows.length === 0) {
      throw new NotFoundException('User not found');
    }
    const targetCompanyId = (targetRows[0] as { company_id: string | null }).company_id;
    if (!this.isAdmin(currentUser) && targetCompanyId !== currentUser.companyId) {
      throw new ForbiddenException('Cannot change user outside current company');
    }
  }

  private async assertPermissionDelegationAllowed(currentUser: JwtUserPayload, permissionCodes: string[]) {
    if (permissionCodes.length === 0) {
      return;
    }

    const validPermissionRows = await this.dataSource.query('select code from permissions where code = any($1::varchar[])', [
      permissionCodes
    ]);
    const validPermissionSet = new Set(validPermissionRows.map((item: { code: string }) => item.code));
    const unknownPermission = permissionCodes.find((code) => !validPermissionSet.has(code));
    if (unknownPermission) {
      throw new BadRequestException(`Unknown permission code: ${unknownPermission}`);
    }

    if (this.isAdmin(currentUser)) {
      return;
    }

    const assignable = await this.getActorPermissionSet(currentUser);
    const blocked = permissionCodes.find((code) => !assignable.has(code));
    if (blocked) {
      throw new ForbiddenException(`Cannot delegate permission: ${blocked}`);
    }
  }

  private async assertRoleDelegationAllowed(currentUser: JwtUserPayload, roleCodes: string[]) {
    if (roleCodes.length === 0) {
      return;
    }

    const validRoleRows = await this.dataSource.query('select code from roles where code = any($1::varchar[])', [roleCodes]);
    const validRoleSet = new Set(validRoleRows.map((item: { code: string }) => item.code));
    const unknownRole = roleCodes.find((code) => !validRoleSet.has(code));
    if (unknownRole) {
      throw new BadRequestException(`Unknown role code: ${unknownRole}`);
    }

    if (this.isAdmin(currentUser)) {
      return;
    }

    if (roleCodes.includes('ADMIN')) {
      throw new ForbiddenException('Cannot grant ADMIN role');
    }

    const rolePermissionRows = await this.dataSource.query(
      `
        select distinct p.code
        from roles r
        join role_permissions rp on rp.role_id = r.id
        join permissions p on p.id = rp.permission_id
        where r.code = any($1::varchar[])
      `,
      [roleCodes]
    );
    const assignable = await this.getActorPermissionSet(currentUser);
    const blocked = rolePermissionRows.find((item: { code: string }) => !assignable.has(item.code));
    if (blocked) {
      throw new ForbiddenException(`Cannot grant role containing permission: ${blocked.code}`);
    }
  }

  private async getActorPermissionSet(currentUser: JwtUserPayload) {
    const rows = await this.dataSource.query(
      `
        select distinct x.code
        from (
          select p.code
          from user_roles ur
          join role_permissions rp on rp.role_id = ur.role_id
          join permissions p on p.id = rp.permission_id
          where ur.user_id = $1
          union
          select p.code
          from user_permissions up
          join permissions p on p.id = up.permission_id
          where up.user_id = $1
        ) x
      `,
      [currentUser.sub]
    );
    return new Set(rows.map((item: { code: string }) => item.code));
  }
}

