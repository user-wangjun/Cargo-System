import * as bcrypt from 'bcryptjs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureRbacTenantSeed } from '../../common/db/rbac-tenant-seed';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserRolesDto } from './dto/update-org-user-roles.dto';

type JwtUserPayload = {
  sub: string;
  roles?: string[];
  companyId?: string | null;
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

  async listRoles() {
    await this.ensureSeeded();
    return this.dataSource.query('select code, name from roles order by code asc');
  }

  async listUsers(currentUser: JwtUserPayload) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    const where = this.isAdmin(currentUser) ? '' : 'where u.company_id = $1';
    const params = this.isAdmin(currentUser) ? [] : [currentUser.companyId];

    return this.dataSource.query(
      `
      select
        u.id,
        u.username,
        u.full_name as "fullName",
        u.phone,
        u.is_active as "isActive",
        u.company_id as "companyId",
        c.name as "companyName",
        coalesce(array_remove(array_agg(distinct r.code), null), '{}') as roles
      from users u
      left join companies c on c.id = u.company_id
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id
      ${where}
      group by u.id, c.name
      order by u.created_at desc
      `,
      params
    );
  }

  async createUser(currentUser: JwtUserPayload, dto: CreateOrgUserDto) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    const companyId = currentUser.companyId ?? null;
    const roleCodes = dto.roleCodes && dto.roleCodes.length > 0 ? dto.roleCodes : ['VIEWER'];
    const passwordHash = bcrypt.hashSync(dto.password, 10);

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
      await this.replaceUserRolesWithScope(currentUser, userId, roleCodes);
      return this.getUserDetailWithScope(currentUser, userId);
    } catch (error) {
      if (error instanceof Error && /users_username_key/.test(error.message)) {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
  }

  async updateUserRoles(currentUser: JwtUserPayload, userId: string, dto: UpdateOrgUserRolesDto) {
    await this.ensureSeeded();
    this.assertCompanyScope(currentUser);

    await this.replaceUserRolesWithScope(currentUser, userId, dto.roleCodes);
    return this.getUserDetailWithScope(currentUser, userId);
  }

  private async getUserDetailWithScope(currentUser: JwtUserPayload, userId: string) {
    const where = this.isAdmin(currentUser) ? 'u.id = $1' : 'u.id = $1 and u.company_id = $2';
    const params = this.isAdmin(currentUser) ? [userId] : [userId, currentUser.companyId];
    const rows = await this.dataSource.query(
      `
      select
        u.id,
        u.username,
        u.full_name as "fullName",
        u.phone,
        u.is_active as "isActive",
        u.company_id as "companyId",
        c.name as "companyName",
        coalesce(array_remove(array_agg(distinct r.code), null), '{}') as roles
      from users u
      left join companies c on c.id = u.company_id
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id
      where ${where}
      group by u.id, c.name
      limit 1
      `,
      params
    );
    if (rows.length === 0) {
      throw new NotFoundException('User not found in current company scope');
    }
    return rows[0];
  }

  private async replaceUserRolesWithScope(currentUser: JwtUserPayload, userId: string, roleCodes: string[]) {
    const targetRows = await this.dataSource.query('select id, company_id from users where id = $1 limit 1', [userId]);
    if (targetRows.length === 0) {
      throw new NotFoundException('User not found');
    }
    const targetCompanyId = (targetRows[0] as { company_id: string | null }).company_id;
    if (!this.isAdmin(currentUser) && targetCompanyId !== currentUser.companyId) {
      throw new ForbiddenException('Cannot change user outside current company');
    }

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
}

