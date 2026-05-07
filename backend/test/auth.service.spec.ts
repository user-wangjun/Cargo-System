import * as bcrypt from 'bcryptjs';
import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/modules/auth/auth.service';

jest.mock('../src/common/db/rbac-tenant-seed', () => ({
  ensureRbacTenantSeed: jest.fn().mockResolvedValue(undefined)
}));

describe('AuthService.changePassword', () => {
  const OWNER_INVITE_CODE = 'TEST_OWNER_INVITE_CODE';
  const jwtService = {
    signAsync: jest.fn()
  } as unknown as JwtService;

  function createService(queryMock: jest.Mock, transactionMock?: jest.Mock) {
    const dataSource = {
      query: queryMock,
      transaction: transactionMock ?? jest.fn()
    } as unknown as DataSource;
    return new AuthService(jwtService, dataSource);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_INVITE_CODE = OWNER_INVITE_CODE;
    process.env.REGISTRATION_SECRET = OWNER_INVITE_CODE;
  });

  it('updates the password hash when the current password is valid', async () => {
    const existingHash = bcrypt.hashSync('old123', 10);
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          username: 'admin',
          phone: '18800000000',
          password_hash: existingHash,
          full_name: 'Admin',
          is_active: true,
          company_id: 'company-1',
          company_name: 'Demo',
          roles: ['ADMIN'],
          permissions: ['finance.edit']
        }
      ])
      .mockResolvedValueOnce([]);
    const service = createService(query);

    const result = await service.changePassword(
      { sub: 'user-1' },
      { oldPassword: 'old123', newPassword: 'new456' }
    );

    expect(result).toEqual({ success: true });
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1][0])).toContain('update users set password_hash = $2');
    expect(query.mock.calls[1][1][0]).toBe('user-1');
    expect(query.mock.calls[1][1][1]).not.toBe('new456');
    expect(bcrypt.compareSync('new456', query.mock.calls[1][1][1] as string)).toBe(true);
  });

  it('rejects reusing the current password', async () => {
    const existingHash = bcrypt.hashSync('same123', 10);
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 'user-1',
        username: 'admin',
        phone: '18800000000',
        password_hash: existingHash,
        full_name: 'Admin',
        is_active: true,
        company_id: 'company-1',
        company_name: 'Demo',
        roles: ['ADMIN'],
        permissions: []
      }
    ]);
    const service = createService(query);

    await expect(
      service.changePassword({ sub: 'user-1' }, { oldPassword: 'same123', newPassword: 'same123' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid current password', async () => {
    const existingHash = bcrypt.hashSync('right123', 10);
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 'user-1',
        username: 'admin',
        phone: '18800000000',
        password_hash: existingHash,
        full_name: 'Admin',
        is_active: true,
        company_id: 'company-1',
        company_name: 'Demo',
        roles: ['ADMIN'],
        permissions: []
      }
    ]);
    const service = createService(query);

    await expect(
      service.changePassword({ sub: 'user-1' }, { oldPassword: 'wrong123', newPassword: 'new123' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('registers a new company owner and returns auth payload', async () => {
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'user-2',
        username: '13800138000',
        phone: '13800138000',
        password_hash: bcrypt.hashSync('boss123', 10),
        full_name: 'Boss',
        is_active: true,
        company_id: 'company-2',
        company_name: '测试企业',
        roles: ['OWNER'],
        permissions: ['user.manage']
      }
    ]);
    const transaction = jest.fn().mockImplementation(async (callback: (manager: { query: jest.Mock }) => Promise<void>) => {
      const manager = {
        query: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'role-owner' }])
          .mockResolvedValueOnce([])
      };
      await callback(manager);
    });
    (jwtService.signAsync as jest.Mock).mockResolvedValue('token-123');
    const service = createService(query, transaction);

    const result = await service.register({
      roleType: 'OWNER',
      companyName: '测试企业',
      username: '13800138000',
      fullName: 'Boss',
      phone: '13800138000',
      password: 'boss123',
      inviteCode: OWNER_INVITE_CODE
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accessToken: 'token-123',
      user: {
        id: 'user-2',
        username: '13800138000',
        phone: '13800138000',
        fullName: 'Boss',
        companyId: 'company-2',
        companyName: '测试企业',
        isActive: true
      },
      roles: ['OWNER'],
      permissions: ['user.manage']
    });
  });

  it('returns account exists when register hits phone unique conflict', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const transaction = jest.fn().mockRejectedValue({
      code: '23505',
      constraint: 'users_phone_unique_idx',
      message: 'duplicate key value violates unique constraint "users_phone_unique_idx"'
    });
    const service = createService(query, transaction);

    await expect(
      service.register({
        roleType: 'OWNER',
        companyName: '测试企业',
        username: '13800138000',
        fullName: 'Boss',
        phone: '13800138000',
        password: 'boss123',
        inviteCode: OWNER_INVITE_CODE
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows login via phone account', async () => {
    const existingHash = bcrypt.hashSync('AdminDemo123', 10);
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 'user-super',
        username: '18800000000',
        phone: '18800000000',
        password_hash: existingHash,
        full_name: 'Super Admin',
        is_active: true,
        company_id: 'company-1',
        company_name: '演示企业',
        roles: ['ADMIN'],
        permissions: ['finance.edit']
      }
    ]);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('token-super');
    const service = createService(query);

    const result = await service.login({
      username: '18800000000',
      password: 'AdminDemo123'
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain('u.username = $1 or u.phone = $1');
    expect(result).toEqual({
      accessToken: 'token-super',
      user: {
        id: 'user-super',
        username: '18800000000',
        phone: '18800000000',
        fullName: 'Super Admin',
        companyId: 'company-1',
        companyName: '演示企业',
        isActive: true
      },
      roles: ['ADMIN'],
      permissions: ['finance.edit']
    });
  });

  it('rejects registration with a wrong registration key', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const transaction = jest.fn().mockImplementation(async (callback: (manager: { query: jest.Mock }) => Promise<void>) => {
      const manager = {
        query: jest.fn()
      };
      await callback(manager);
    });
    const service = createService(query, transaction);

    await expect(
      service.register({
        roleType: 'OWNER',
        companyName: '测试企业',
        username: '13800138001',
        fullName: 'Boss',
        phone: '13800138001',
        password: 'boss123',
        inviteCode: 'wrong-key'
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects registration when the registration secret is missing', async () => {
    delete process.env.OWNER_INVITE_CODE;
    delete process.env.REGISTRATION_SECRET;
    const query = jest.fn().mockResolvedValueOnce([]);
    const transaction = jest.fn().mockImplementation(async (callback: (manager: { query: jest.Mock }) => Promise<void>) => {
      const manager = {
        query: jest.fn()
      };
      await callback(manager);
    });
    const service = createService(query, transaction);

    await expect(
      service.register({
        roleType: 'OWNER',
        companyName: '测试企业',
        username: '13800138002',
        fullName: 'Boss',
        phone: '13800138002',
        password: 'boss123',
        inviteCode: OWNER_INVITE_CODE
      })
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
