import {
  IsMongoId,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class ApplyBenefitPreviewDto {
  @IsMongoId({ message: 'pet_id is required and must be a valid MongoId' })
  pet_id: string;

  @IsArray({ message: 'selected_benefit_ids must be an array' })
  @IsNotEmpty({ message: 'selected_benefit_ids cannot be empty' })
  @IsMongoId({ each: true, message: 'Each benefit id must be a valid MongoId' })
  selected_benefit_ids: string[];

  @IsOptional()
  @IsMongoId({ message: 'store_id must be a valid MongoId' })
  store_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'service_id must be a valid MongoId' })
  service_id?: string;

  @IsOptional()
  @IsArray({ message: 'add_on_ids must be an array' })
  @IsMongoId({ each: true, message: 'Each add_on_id must be a valid MongoId' })
  add_on_ids?: string[];

  @IsOptional()
  @IsNumber({}, { message: 'original_total_price must be a number' })
  @Min(0)
  original_total_price?: number;

  @IsOptional()
  @IsDateString({}, { message: 'booking_date must be a valid ISO date string' })
  booking_date?: string;

  @IsOptional()
  @IsBoolean({ message: 'pick_up must be a boolean' })
  pick_up?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'delivery must be a boolean' })
  delivery?: boolean;

  @IsOptional()
  @IsMongoId({ message: 'exclude_booking_id must be a valid MongoId' })
  exclude_booking_id?: string;
}
