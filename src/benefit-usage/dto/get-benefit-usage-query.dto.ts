import { IsOptional, IsMongoId } from 'class-validator';

export class GetBenefitUsageQueryDto {
  @IsOptional()
  @IsMongoId({ message: 'pet_membership_id must be a valid MongoDB ID' })
  pet_membership_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'booking_id must be a valid MongoDB ID' })
  booking_id?: string;
}
