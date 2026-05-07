import { IsArray, IsString } from 'class-validator';

export class UpdateOrgUserPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
