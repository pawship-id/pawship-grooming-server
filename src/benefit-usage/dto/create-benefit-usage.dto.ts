import { Type } from 'class-transformer';
import { IsNotEmpty, IsMongoId, IsNumber, Min } from 'class-validator';

export class CreateBenefitUsageDto {
  @IsNotEmpty({ message: 'pet_membership_id is required' })
  @IsMongoId({ message: 'pet_membership_id must be a valid MongoDB ID' })
  pet_membership_id: string;

  @IsNotEmpty({ message: 'benefit_id is required' })
  @IsMongoId({ message: 'benefit_id must be a valid MongoDB ID' })
  benefit_id: string;

  @IsNotEmpty({ message: 'booking_id is required' })
  @IsMongoId({ message: 'booking_id must be a valid MongoDB ID' })
  booking_id: string;

  @IsNotEmpty({ message: 'target_id is required' })
  @IsMongoId({ message: 'target_id must be a valid MongoDB ID' })
  target_id: string;

  @IsNotEmpty({ message: 'amount_used is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount_used must be a number' })
  @Min(0, { message: 'amount_used must be >= 0' })
  amount_used: number;
}
