import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class ApplyPromotionPreviewDto {
  @IsArray({ message: 'selected_promotion_ids must be an array' })
  @IsNotEmpty({ message: 'selected_promotion_ids cannot be empty' })
  @IsMongoId({
    each: true,
    message: 'Each promotion id must be a valid MongoId',
  })
  selected_promotion_ids: string[];

  @IsNotEmpty({ message: 'service_id is required' })
  @IsMongoId({ message: 'service_id must be a valid MongoId' })
  service_id: string;

  @IsOptional()
  @IsArray({ message: 'addon_ids must be an array' })
  @IsMongoId({ each: true, message: 'Each addon_id must be a valid MongoId' })
  addon_ids?: string[];

  @IsOptional()
  @IsNumber({}, { message: 'original_service_price must be a number' })
  @Min(0)
  original_service_price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'travel_fee must be a number' })
  @Min(0)
  travel_fee?: number;

  @IsOptional()
  @IsNumber({}, { message: 'grand_total must be a number' })
  @Min(0)
  grand_total?: number;

  @IsOptional()
  @IsBoolean({ message: 'pick_up must be a boolean' })
  pick_up?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'delivery must be a boolean' })
  delivery?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'has_active_membership must be a boolean' })
  has_active_membership?: boolean;

  @IsOptional()
  addon_prices?: { _id: string; name: string; price: number }[];

  @IsOptional()
  @IsMongoId({ message: 'customer_id must be a valid MongoId' })
  customer_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'pet_id must be a valid MongoId' })
  pet_id?: string;

  @IsOptional()
  booking_date?: string;

  @IsOptional()
  @IsMongoId({ message: 'exclude_booking_id must be a valid MongoId' })
  exclude_booking_id?: string;
}
