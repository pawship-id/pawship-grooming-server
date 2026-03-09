import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum PromoType {
  MEMBERSHIP_BENEFIT = 'membership_benefit',
  GENERAL_PROMO = 'general_promo',
}

export enum ClaimType {
  ONCE_PER_MEMBERSHIP = 'once_per_membership',
  EVERY_ADD_ON = 'every_add_on',
  ONCE_PER_BOOKING = 'once_per_booking',
}

export enum BenefitType {
  DISCOUNT = 'discount',
  FREE_SERVICE = 'free_service',
}

export enum DiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// ─── Nested DTOs ─────────────────────────────────────────────────────────────

export class BenefitDto {
  @IsNotEmpty({ message: 'benefit type is required' })
  @IsEnum(BenefitType, {
    message: 'benefit type must be discount or free_service',
  })
  type: BenefitType;

  @ValidateIf((o: BenefitDto) => o.type === BenefitType.DISCOUNT)
  @IsNotEmpty({
    message: 'discount_type is required when benefit type is discount',
  })
  @IsEnum(DiscountType, { message: 'discount_type must be percent or fixed' })
  discount_type?: DiscountType;

  @ValidateIf((o: BenefitDto) => o.type === BenefitType.DISCOUNT)
  @IsNotEmpty({ message: 'value is required when benefit type is discount' })
  @IsNumber({}, { message: 'value must be a number' })
  @Min(0, { message: 'value cannot be negative' })
  @Type(() => Number)
  value?: number;

  @ValidateIf((o: BenefitDto) => o.type === BenefitType.FREE_SERVICE)
  @IsNotEmpty({
    message: 'service_id is required when benefit type is free_service',
  })
  @IsMongoId({ message: 'service_id must be a valid MongoDB ObjectId' })
  service_id?: string;
}

export class EligibilityDto {
  @IsNotEmpty({ message: 'is only for membership is required' })
  @IsBoolean({ message: 'is only for membership must be a boolean' })
  is_only_for_membership: boolean;

  @IsOptional()
  @IsArray({ message: 'membership_ids must be an array' })
  @IsMongoId({
    each: true,
    message: 'each membership_id must be a valid MongoDB ObjectId',
  })
  membership_ids?: string[];

  @IsOptional()
  @IsBoolean({ message: 'first_time_user must be a boolean' })
  first_time_user?: boolean;
}

export class ValidityDto {
  @IsNotEmpty({ message: 'start_at is required' })
  @IsDateString({}, { message: 'start_at must be a valid ISO date string' })
  start_at: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_at must be a valid ISO date string' })
  end_at?: string;
}

// ─── Create DTO ──────────────────────────────────────────────────────────────

export class CreatePromotionDto {
  @IsNotEmpty({ message: 'code is required' })
  code: string;

  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsOptional()
  description?: string;

  @IsNotEmpty({ message: 'promo_type is required' })
  @IsEnum(PromoType, {
    message: 'promo_type must be membership_benefit or general_promo',
  })
  promo_type: PromoType;

  @IsNotEmpty({ message: 'claim_type is required' })
  @IsEnum(ClaimType, {
    message:
      'claim_type must be once_per_membership, every_add_on, or once_per_booking',
  })
  claim_type: ClaimType;

  @IsNotEmpty({ message: 'benefit is required' })
  @ValidateNested()
  @Type(() => BenefitDto)
  benefit: BenefitDto;

  @IsNotEmpty({ message: 'eligibility is required' })
  @ValidateNested()
  @Type(() => EligibilityDto)
  eligibility: EligibilityDto;

  @IsNotEmpty({ message: 'validity is required' })
  @ValidateNested()
  @Type(() => ValidityDto)
  validity: ValidityDto;

  @IsOptional()
  @IsBoolean({ message: 'stackable must be a boolean' })
  stackable?: boolean;

  @IsOptional()
  @IsInt({ message: 'priority must be an integer' })
  @Min(0, { message: 'priority cannot be negative' })
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;
}
