import { Type } from 'class-transformer';
import { IsNotEmpty, IsMongoId, IsNumber, Min, IsDate, IsEnum, IsOptional } from 'class-validator';
import { BenefitPeriod } from 'src/membership/entities/membership.entity';

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

  /** The scheduled booking date — determines which period slot owns this usage. */
  @IsNotEmpty({ message: 'booking_date is required' })
  @Type(() => Date)
  @IsDate({ message: 'booking_date must be a date' })
  booking_date: Date;

  /**
   * Period slot key: "YYYY-WNN" (weekly), "YYYY-MM" (monthly), null (unlimited).
   * Computed by the caller before persisting.
   */
  period_key: string | null;

  @IsNotEmpty({ message: 'benefit_period is required' })
  @IsEnum(BenefitPeriod)
  benefit_period: BenefitPeriod;
}
