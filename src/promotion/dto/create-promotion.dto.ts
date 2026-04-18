import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum AppliesTo {
  SERVICE = 'service',
  ADDON = 'addon',
  PICKUP = 'pickup',
  BOOKING = 'booking',
}

export enum DiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

export enum PromotionLimitType {
  NONE = 'none',
  PER_USER = 'per_user',
  PER_PET = 'per_pet',
}

export enum PromotionUsagePeriod {
  LIFETIME = 'lifetime',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// ─── Create DTO ──────────────────────────────────────────────────────────────

export class CreatePromotionDto {
  @IsNotEmpty({ message: 'code is required' })
  code!: string;

  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsOptional()
  description?: string;

  @IsNotEmpty({ message: 'applies_to is required' })
  @IsEnum(AppliesTo, {
    message: 'applies_to must be service, addon, pickup, or booking',
  })
  applies_to!: AppliesTo;

  @IsOptional()
  @ValidateIf(
    (o: CreatePromotionDto) =>
      o.service_id !== null && o.service_id !== undefined,
  )
  @IsMongoId({ message: 'service_id must be a valid MongoDB ObjectId' })
  service_id?: string | null;

  @IsNotEmpty({ message: 'discount_type is required' })
  @IsEnum(DiscountType, {
    message: 'discount_type must be percent or fixed',
  })
  discount_type!: DiscountType;

  @IsNotEmpty({ message: 'value is required' })
  @IsNumber({}, { message: 'value must be a number' })
  @Min(0, { message: 'value cannot be negative' })
  @Type(() => Number)
  value!: number;

  @IsNotEmpty({ message: 'start_date is required' })
  @IsDateString({}, { message: 'start_date must be a valid ISO date string' })
  start_date!: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_date must be a valid ISO date string' })
  end_date?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_available_to_membership must be a boolean' })
  is_available_to_membership?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'is_stackable must be a boolean' })
  is_stackable?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;

  @IsOptional()
  @IsEnum(PromotionLimitType, {
    message: 'limit_type must be none, per_user, or per_pet',
  })
  limit_type?: PromotionLimitType;

  @ValidateIf(
    (o: CreatePromotionDto) => o.limit_type !== PromotionLimitType.NONE,
  )
  @IsNotEmpty({ message: 'max_usage is required when limit_type is enabled' })
  @IsNumber({}, { message: 'max_usage must be a number' })
  @Min(1, { message: 'max_usage must be at least 1' })
  @Type(() => Number)
  max_usage?: number | null;

  @ValidateIf(
    (o: CreatePromotionDto) => o.limit_type !== PromotionLimitType.NONE,
  )
  @IsNotEmpty({
    message: 'usage_period is required when limit_type is enabled',
  })
  @IsEnum(PromotionUsagePeriod, {
    message: 'usage_period must be lifetime, daily, weekly, or monthly',
  })
  usage_period?: PromotionUsagePeriod;
}
