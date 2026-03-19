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
} from 'class-validator';
import {
  BenefitType,
  BenefitScope,
  BenefitPeriod,
} from '../entities/membership.entity';

class CreateMembershipBenefitDto {
  @IsEnum(BenefitType, {
    message: 'type must be one of: discount, free_service, quota',
  })
  type: BenefitType;

  @IsEnum(BenefitScope, {
    message: 'applies_to must be one of: service, addon, order',
  })
  applies_to: BenefitScope;

  @IsOptional()
  period?: BenefitPeriod = BenefitPeriod.UNLIMITED;

  @IsOptional()
  @IsNumber({}, { message: 'value must be a number' })
  @Min(0, { message: 'value must be >= 0' })
  value?: number;

  @IsOptional()
  @IsMongoId({ message: 'service_id must be a valid MongoDB ID' })
  service_id?: string;

  @IsOptional()
  @IsNumber({}, { message: 'limit must be a number' })
  @Min(-1, { message: 'limit must be >= -1 (-1 for unlimited)' })
  limit?: number;
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
}
