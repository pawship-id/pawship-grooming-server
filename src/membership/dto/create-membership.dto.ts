import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
  IsMongoId,
  IsEnum,
  Min,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import {
  BenefitType,
  BenefitScope,
  BenefitPeriod,
} from '../entities/membership.entity';

class CreateMembershipBenefitDto {
  @IsEnum(BenefitScope, {
    message: 'applies_to must be one of: service, addon, pickup',
  })
  applies_to: BenefitScope;

  @IsOptional()
  @IsMongoId({ message: 'service_id must be a valid MongoDB ID' })
  service_id?: string;

  @ValidateIf((o) => !o.service_id)
  @IsNotEmpty({ message: 'label is required when service_id is not provided' })
  @IsString({ message: 'label must be a string' })
  label?: string;

  @IsEnum(BenefitType, {
    message: 'type must be one of: discount, quota',
  })
  type: BenefitType;

  @IsOptional()
  @IsEnum(BenefitPeriod, {
    message: 'period must be one of: weekly, monthly, unlimited',
  })
  period?: BenefitPeriod = BenefitPeriod.UNLIMITED;

  @IsOptional()
  @IsNumber({}, { message: 'limit must be a number' })
  @Min(0, { message: 'limit must be >= 0' })
  limit?: number;

  @ValidateIf((o) => o.type === BenefitType.DISCOUNT)
  @IsNotEmpty({ message: 'value is required for discount type' })
  @IsNumber({}, { message: 'value must be a number' })
  @Min(0, { message: 'value must be >= 0' })
  value?: number;
}

export class CreateMembershipDto {
  @IsNotEmpty({ message: 'name is required' })
  @IsString({ message: 'name must be a string' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @IsNotEmpty({ message: 'duration_months is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'duration_months must be a number' })
  @Min(1, { message: 'duration_months must be >= 1' })
  duration_months: number;

  @IsNotEmpty({ message: 'price is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price must be >= 0' })
  price: number;

  @IsOptional()
  @IsString({ message: 'note must be a string' })
  note?: string;

  @IsOptional()
  @IsArray({ message: 'pet_type_ids must be an array' })
  @ArrayMinSize(0, { message: 'pet_type_ids must have at least 0 items' })
  @IsMongoId({
    message: 'each pet_type_id must be a valid MongoDB ID',
    each: true,
  })
  pet_type_ids?: string[];

  @IsOptional()
  @IsArray({ message: 'benefits must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateMembershipBenefitDto)
  benefits?: CreateMembershipBenefitDto[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
