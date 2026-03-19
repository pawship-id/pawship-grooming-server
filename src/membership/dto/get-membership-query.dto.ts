import { Type } from 'class-transformer';
import { IsOptional, IsMongoId, IsBoolean, IsArray } from 'class-validator';

export class GetMembershipQueryDto {
  @IsOptional()
  @IsMongoId({ message: 'pet_type_id must be a valid MongoDB ID' })
  pet_type_id?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  @Type(() => Boolean)
  is_active?: boolean;
}
