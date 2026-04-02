import { IsArray, IsString } from 'class-validator';

export class UpdateOrgUserRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

