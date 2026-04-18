import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddonPriceDto {
  @IsMongoId({ message: 'addon_id must be a valid MongoId' })
  addon_id: string;

  @IsOptional()
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price must be >= 0' })
  price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'discount must be a number' })
  @Min(0, { message: 'discount must be >= 0' })
  discount?: number;
}

export class UpdateBookingPricingDto {
  @IsOptional()
  @IsNumber({}, { message: 'service_price must be a number' })
  @Min(0, { message: 'service_price must be >= 0' })
  service_price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'service_discount must be a number' })
  @Min(0, { message: 'service_discount must be >= 0' })
  service_discount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'travel_fee must be a number' })
  @Min(0, { message: 'travel_fee must be >= 0' })
  travel_fee?: number;

  @IsOptional()
  @IsNumber({}, { message: 'travel_fee_discount must be a number' })
  @Min(0, { message: 'travel_fee_discount must be >= 0' })
  travel_fee_discount?: number;

  @IsOptional()
  @IsArray({ message: 'addon_prices must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AddonPriceDto)
  addon_prices?: AddonPriceDto[];

  @IsOptional()
  @IsArray({ message: 'service_addon_ids must be an array' })
  @IsString({ each: true, message: 'Each service_addon_id must be a string' })
  service_addon_ids?: string[];

  @IsOptional()
  @IsBoolean({ message: 'pick_up must be a boolean' })
  pick_up?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'delivery must be a boolean' })
  delivery?: boolean;

  @IsOptional()
  @IsArray({ message: 'selected_benefit_ids must be an array' })
  @IsMongoId({ each: true, message: 'Each benefit id must be a valid MongoId' })
  selected_benefit_ids?: string[];

  @IsOptional()
  @IsArray({ message: 'selected_promotion_ids must be an array' })
  @IsMongoId({
    each: true,
    message: 'Each promotion id must be a valid MongoId',
  })
  selected_promotion_ids?: string[];
}
