import { IsOptional, IsMongoId, IsIn } from 'class-validator';

export class GetPetMembershipQueryDto {
  @IsOptional()
  @IsMongoId({ message: 'pet_id must be a valid MongoDB ID' })
  pet_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'membership_plan_id must be a valid MongoDB ID' })
  membership_plan_id?: string;

  @IsOptional()
  @IsIn(['active', 'pending', 'expired', 'cancelled'])
  status?: 'active' | 'pending' | 'expired' | 'cancelled';
}
