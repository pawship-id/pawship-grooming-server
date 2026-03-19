import { IsOptional, IsMongoId, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPetMembershipQueryDto {
  @IsOptional()
  @IsMongoId({ message: 'pet_id must be a valid MongoDB ID' })
  pet_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'membership_plan_id must be a valid MongoDB ID' })
  membership_plan_id?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  @Type(() => Boolean)
  is_active?: boolean;
}
