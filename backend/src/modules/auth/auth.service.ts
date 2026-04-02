import * as bcrypt from 'bcryptjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ensureRbacTenantSeed } from '../../common/db/rbac-tenant-seed';
import { LoginDto } from './dto/login.dto';

type LoginUserRow = {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  company_id: string | null;
  company_name: string | null;
  roles: string[] | null;
  permissions: string[] | null;
};

@Injectable()
export class AuthService {
  private seedPromise?: Promise<void>;

  constructor(
    private readonly jwtService: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  private async ensureSeeded() {
    if (!this.seedPromise) {
      this.seedPromise = ensureRbacTenantSeed(this.dataSource);
    }
    await this.seedPromise;
  }

  private verifyPassword(inputPassword: string, storedHash: string): boolean {
    if (!storedHash) {
      return false;
    }
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return bcrypt.compareSync(inputPassword, storedHash);
    }
    return inputPassword === storedHash;
  }

  async login(dto: LoginDto) {
    await this.ensureSeeded();

    const rows = await this.dataSource.query(
      `
        select
          u.id,
          u.username,
          u.password_hash,
          u.full_name,
          u.is_active,
          u.company_id,
          c.name as company_name,
          array_remove(array_agg(distinct r.code), null) as roles,
          array_remove(array_agg(distinct p.code), null) as permissions
        from users u
        left join companies c on c.id = u.company_id
        left join user_roles ur on ur.user_id = u.id
        left join roles r on r.id = ur.role_id
        left join role_permissions rp on rp.role_id = r.id
        left join permissions p on p.id = rp.permission_id
        where u.username = $1
        group by u.id, c.name
        limit 1
      `,
      [dto.username]
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = rows[0] as LoginUserRow;
    if (!user.is_active || !this.verifyPassword(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.roles ?? [];
    const permissions = user.permissions ?? [];

    const payload = {
      sub: user.id,
      username: user.username,
      fullName: user.full_name,
      companyId: user.company_id,
      companyName: user.company_name,
      roles,
      permissions
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        companyId: user.company_id,
        companyName: user.company_name,
        isActive: user.is_active
      },
      roles,
      permissions
    };
  }

  me(user: Record<string, unknown>) {
    return {
      id: user.sub,
      username: user.username,
      fullName: user.fullName,
      companyId: user.companyId,
      companyName: user.companyName,
      isActive: true,
      roles: user.roles,
      permissions: user.permissions
    };
  }
}
