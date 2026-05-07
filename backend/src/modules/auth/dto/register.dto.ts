import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  fullName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['OWNER', 'EMPLOYEE'])
  roleType!: 'OWNER' | 'EMPLOYEE';

  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;

  // 兼容旧版字段（老板注册时仍可透传）
  @IsOptional()
  @IsString()
  registrationKey?: string;
}
