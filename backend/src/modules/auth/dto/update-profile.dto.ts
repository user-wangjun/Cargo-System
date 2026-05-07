import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  realName?: string;

  @IsOptional()
  @IsString()
  // Deprecated: accepted for backward compatibility, but ignored by service.
  idCardNo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(|1\d{10})$/, { message: '手机号应为11位数字' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(|[^\s@]+@[^\s@]+\.[^\s@]+)$/, { message: '邮箱格式不正确' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  gender?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(|\d{4}-\d{2}-\d{2})$/, { message: '生日格式应为 YYYY-MM-DD' })
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
