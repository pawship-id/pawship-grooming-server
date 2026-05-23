import { IsOptional, IsMongoId, IsIn, IsInt, Min, Max, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
