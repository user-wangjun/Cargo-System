import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ensureRbacTenantSeed } from '../../common/db/rbac-tenant-seed';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type LoginUserRow = {
  id: string;
  username: string;
  phone: string | null;
  password_hash: string;
  full_name: string;
  real_name: string | null;
  email: string | null;
  gender: string | null;
  birthday: string | null;
  address: string | null;
  is_active: boolean;
  company_id: string | null;
  company_name: string | null;
  company_invite_code: string | null;
  roles: string[] | null;
  permissions: string[] | null;
};

type PgUniqueViolation = {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
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

  private async findLoginUser(whereClause: string, value: string): Promise<LoginUserRow | null> {
    const rows = await this.dataSource.query(
      `
        select
          u.id,
          u.username,
          u.phone,
          u.password_hash,
          u.full_name,
          u.real_name,
          u.email,
          u.gender,
          to_char(u.birthday, 'YYYY-MM-DD') as birthday,
          u.address,
          u.is_active,
          u.company_id,
          c.name as company_name,
          c.invite_code as company_invite_code,
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
        limit 1
      `,
      [value]
    );

    return rows.length > 0 ? (rows[0] as LoginUserRow) : null;
  }

  private async findLoginUserByUsername(username: string): Promise<LoginUserRow | null> {
    return this.findLoginUser('u.username = $1', username);
  }

  private async findLoginUserByAccount(account: string): Promise<LoginUserRow | null> {
    return this.findLoginUser('(u.username = $1 or u.phone = $1)', account);
  }

  private async findLoginUserById(userId: string): Promise<LoginUserRow | null> {
    return this.findLoginUser('u.id = $1', userId);
  }

  private async getActiveUserOrThrow(userId: string): Promise<LoginUserRow> {
    const user = await this.findLoginUserById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 40113,
        message: 'Current login session is no longer valid'
      });
    }
    if (!user.is_active) {
      throw new UnauthorizedException({
        code: 40103,
        message: 'User account is disabled'
      });
    }
    return user;
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeOptionalText(value: unknown, maxLength = 255): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
  }

  private hasBossRole(user: LoginUserRow): boolean {
    const roles = user.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('OWNER');
  }

  private isPhoneLike(value: string): boolean {
    return /^\d{11}$/.test(value);
  }

  private isStrongPassword(password: string): boolean {
    return /^(?=.*[A-Za-z])(?=.*\d).{7,}$/.test(password);
  }

  private isUniqueViolation(error: unknown): error is PgUniqueViolation {
    return typeof error === 'object' && error !== null && 'code' in error && (error as PgUniqueViolation).code === '23505';
  }

  private isRegisterAccountConflict(error: unknown): boolean {
    if (!this.isUniqueViolation(error)) {
      return false;
    }
    const constraintHint = [error.constraint, error.detail, error.message]
      .filter((item): item is string => typeof item === 'string')
      .join(' ')
      .toLowerCase();
    return (
      constraintHint.includes('users_phone_unique_idx') ||
      constraintHint.includes('users_phone_key') ||
      constraintHint.includes('users_username_key')
    );
  }

  private isProfilePhoneConflict(error: unknown): boolean {
    if (!this.isUniqueViolation(error)) {
      return false;
    }
    const constraintHint = [error.constraint, error.detail, error.message]
      .filter((item): item is string => typeof item === 'string')
      .join(' ')
      .toLowerCase();
    return constraintHint.includes('users_phone_unique_idx') || constraintHint.includes('users_phone_key');
  }

  private generateCompanyCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const all = letters + digits;
    let result = letters[Math.floor(Math.random() * letters.length)] + digits[Math.floor(Math.random() * digits.length)];
    while (result.length < 6) {
      result += all[Math.floor(Math.random() * all.length)];
    }
    return result
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  private async allocateCompanyCode(manager: EntityManager): Promise<string> {
    for (let i = 0; i < 16; i += 1) {
      const code = this.generateCompanyCode();
      const rows = await manager.query('select id from companies where company_code = $1 limit 1', [code]);
      if (rows.length === 0) {
        return code;
      }
    }
    throw new InternalServerErrorException('Unable to allocate unique company code');
  }

  private toAuthUser(user: LoginUserRow, includeCompanyInviteCode = false) {
    const result: Record<string, unknown> = {
      id: user.id,
      username: user.username,
      phone: user.phone,
      fullName: user.full_name,
      realName: user.real_name,
      email: user.email,
      gender: user.gender,
      birthday: user.birthday,
      address: user.address,
      companyId: user.company_id,
      companyName: user.company_name,
      isActive: user.is_active
    };
    if (includeCompanyInviteCode && user.company_invite_code) {
      result.companyInviteCode = user.company_invite_code;
    }
    return result;
  }

  private async buildAuthResponse(user: LoginUserRow) {
    const roles = user.roles ?? [];
    const permissions = user.permissions ?? [];
    const includeCompanyInviteCode = roles.includes('ADMIN') || roles.includes('OWNER');

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
      user: this.toAuthUser(user, includeCompanyInviteCode),
      roles,
      permissions
    };
  }

  async login(dto: LoginDto) {
    await this.ensureSeeded();

    const account = dto.username.trim();
    const user = await this.findLoginUserByAccount(account);
    if (!user) {
      throw new UnauthorizedException({
        code: 40102,
        message: 'Invalid account or password'
      });
    }

    if (!user.is_active) {
      throw new UnauthorizedException({
        code: 40103,
        message: 'User account is disabled'
      });
    }

    if (!this.verifyPassword(dto.password, user.password_hash)) {
      throw new UnauthorizedException({
        code: 40102,
        message: 'Invalid account or password'
      });
    }

    if (dto.companyName?.trim()) {
      const inputCompany = this.normalizeName(dto.companyName);
      const currentCompany = this.normalizeName(user.company_name ?? '');
      if (!currentCompany || inputCompany !== currentCompany) {
        throw new UnauthorizedException({
          code: 40104,
          message: 'Company does not match this account'
        });
      }
    }

    if (dto.loginRole) {
      const boss = this.hasBossRole(user);
      if (dto.loginRole === 'OWNER' && !boss) {
        throw new UnauthorizedException({
          code: 40105,
          message: 'Selected login role is not allowed for this account'
        });
      }
      if (dto.loginRole === 'EMPLOYEE' && boss) {
        throw new UnauthorizedException({
          code: 40105,
          message: 'Selected login role is not allowed for this account'
        });
      }
    }

    return this.buildAuthResponse(user);
  }

  async register(dto: RegisterDto) {
    await this.ensureSeeded();

    const loginAccount = (dto.phone || dto.username || '').trim();
    if (!loginAccount) {
      throw new BadRequestException('Phone number is required as login account');
    }
    if (!this.isPhoneLike(loginAccount)) {
      throw new BadRequestException('Phone number must be 11 digits');
    }
    if (!this.isStrongPassword(dto.password)) {
      throw new BadRequestException('Password must be longer than 6 chars and include letters and digits');
    }
    if (!dto.companyName?.trim()) {
      throw new BadRequestException('Company name is required');
    }

    const exists = await this.findLoginUserByAccount(loginAccount);
    if (exists) {
      throw new BadRequestException('Account already exists');
    }
    const roleType = dto.roleType;
    const userId = randomUUID();
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    const fullName = dto.fullName?.trim() || loginAccount;
    const phone = (dto.phone ?? loginAccount).trim() || loginAccount;

    try {
      await this.dataSource.transaction(async (manager) => {
        let companyId = '';
        let roleCode = '';

        if (roleType === 'OWNER') {
          const expectedInviteCode = process.env.OWNER_INVITE_CODE?.trim() || process.env.REGISTRATION_SECRET?.trim();
          if (!expectedInviteCode) {
            throw new InternalServerErrorException('Owner invite code is not configured');
          }
          const inputInviteCode = (dto.inviteCode || dto.registrationKey || '').trim();
          if (!inputInviteCode || inputInviteCode !== expectedInviteCode) {
            throw new BadRequestException('Owner invite code is invalid');
          }

          companyId = randomUUID();
          roleCode = 'OWNER';
          const companyCode = await this.allocateCompanyCode(manager);
          const companyInviteCode = await this.allocateCompanyCode(manager);
          await manager.query(
            `
            insert into companies (id, company_code, invite_code, name, is_active)
            values ($1, $2, $3, $4, true)
          `,
            [companyId, companyCode, companyInviteCode, dto.companyName.trim()]
          );
        } else {
          const inviteCode = (dto.inviteCode || '').trim().toUpperCase();
          if (!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6}$/.test(inviteCode)) {
            throw new BadRequestException('Invite code must be 6 uppercase letters/digits');
          }

          const companyRows = await manager.query(
            `
            select id, name
            from companies
            where lower(name) = lower($1)
              and invite_code = $2
            limit 1
          `,
            [dto.companyName.trim(), inviteCode]
          );
          if (companyRows.length === 0) {
            throw new BadRequestException('Company invite code is invalid');
          }
          const company = companyRows[0] as { id: string; name: string };
          companyId = company.id;
          roleCode = 'VIEWER';
        }

        await manager.query(
          `
          insert into users (id, username, password_hash, full_name, is_active, company_id, phone)
          values ($1, $2, $3, $4, true, $5, $6)
        `,
          [userId, loginAccount, passwordHash, fullName, companyId, phone]
        );

        const roleRows = await manager.query('select id from roles where code = $1 limit 1', [roleCode]);
        if (roleRows.length === 0) {
          throw new BadRequestException(`${roleCode} role is not initialized`);
        }

        await manager.query(
          `
          insert into user_roles (user_id, role_id)
          values ($1, $2)
          on conflict (user_id, role_id) do nothing
        `,
          [userId, (roleRows[0] as { id: string }).id]
        );
      });
    } catch (error) {
      if (this.isRegisterAccountConflict(error)) {
        throw new BadRequestException('Account already exists');
      }
      throw error;
    }

    const registeredUser = await this.findLoginUserById(userId);
    if (!registeredUser) {
      throw new BadRequestException('Failed to load registered user');
    }

    return this.buildAuthResponse(registeredUser);
  }

  async me(user: Record<string, unknown>) {
    await this.ensureSeeded();

    const currentUserId = typeof user.sub === 'string' ? user.sub : '';
    const currentUser = await this.getActiveUserOrThrow(currentUserId);
    const includeCompanyInviteCode = (currentUser.roles ?? []).includes('ADMIN') || (currentUser.roles ?? []).includes('OWNER');

    return {
      ...this.toAuthUser(currentUser, includeCompanyInviteCode),
      roles: currentUser.roles ?? [],
      permissions: currentUser.permissions ?? []
    };
  }

  async updateProfile(user: Record<string, unknown>, dto: UpdateProfileDto) {
    await this.ensureSeeded();

    const currentUserId = typeof user.sub === 'string' ? user.sub : '';
    const currentUser = await this.getActiveUserOrThrow(currentUserId);

    const realName = 'realName' in dto ? this.normalizeOptionalText(dto.realName, 60) : currentUser.real_name;
    const phone = 'phone' in dto ? this.normalizeOptionalText(dto.phone, 30) : currentUser.phone;
    const email = 'email' in dto ? this.normalizeOptionalText(dto.email, 120) : currentUser.email;
    const gender = 'gender' in dto
      ? this.normalizeOptionalText(dto.gender, 16)?.toUpperCase() ?? null
      : currentUser.gender;
    const birthday = 'birthday' in dto ? this.normalizeOptionalText(dto.birthday, 10) : currentUser.birthday;
    const address = 'address' in dto ? this.normalizeOptionalText(dto.address, 255) : currentUser.address;
    const fullName = realName ?? currentUser.full_name;

    if (gender && !['MALE', 'FEMALE', 'UNKNOWN'].includes(gender)) {
      throw new BadRequestException('Gender must be MALE/FEMALE/UNKNOWN');
    }

    try {
      await this.dataSource.query(
        `
          update users
          set
            real_name = $2,
            id_card_no = null,
            phone = $3,
            email = $4,
            gender = $5,
            birthday = $6,
            address = $7,
            full_name = $8,
            updated_at = now()
          where id = $1
        `,
        [currentUser.id, realName, phone, email, gender, birthday, address, fullName]
      );
    } catch (error) {
      if (this.isProfilePhoneConflict(error)) {
        throw new BadRequestException('Phone already exists');
      }
      throw error;
    }

    const latestUser = await this.getActiveUserOrThrow(currentUser.id);
    const includeCompanyInviteCode = (latestUser.roles ?? []).includes('ADMIN') || (latestUser.roles ?? []).includes('OWNER');

    return {
      ...this.toAuthUser(latestUser, includeCompanyInviteCode),
      roles: latestUser.roles ?? [],
      permissions: latestUser.permissions ?? []
    };
  }

  async changePassword(user: Record<string, unknown>, dto: ChangePasswordDto) {
    await this.ensureSeeded();

    const currentUserId = typeof user.sub === 'string' ? user.sub : '';
    const currentUser = await this.getActiveUserOrThrow(currentUserId);

    if (!this.verifyPassword(dto.oldPassword, currentUser.password_hash)) {
      throw new UnauthorizedException({
        code: 40102,
        message: 'Invalid account or password'
      });
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const passwordHash = bcrypt.hashSync(dto.newPassword, 10);
    await this.dataSource.query('update users set password_hash = $2, updated_at = now() where id = $1', [
      currentUser.id,
      passwordHash
    ]);

    return { success: true };
  }
}
