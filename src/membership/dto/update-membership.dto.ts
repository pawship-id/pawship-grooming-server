import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMembershipDto } from './create-membership.dto';

export class UpdateMembershipDto extends PartialType(CreateMembershipDto) {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  apply_retroactive?: boolean;
}
