import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ServicePriceDto {
  @IsOptional()
  @IsMongoId({ message: 'pet type must be a valid ID' })
  pet_type_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'size must be a valid ID' })
  size_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'hair must be a valid ID' })
  hair_id?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price cannot be negative' })
  price: number;
}

export class CreateServiceDto {
  @IsNotEmpty({ message: 'code is required' })
  code: string;

  @IsNotEmpty({ message: 'name service is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsMongoId({ message: 'service type must be a valid ID' })
  @IsNotEmpty({ message: 'service type is required' })
  service_type_id: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each pet type must be a valid ID' })
  pet_type_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each size category must be a valid ID' })
  size_category_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each hair category must be a valid ID' })
  hair_category_ids?: string[];

  @IsNotEmpty({ message: 'price type is required' })
  @IsEnum(['single', 'multiple'], {
    message: 'price type must be either single or multiple',
  })
  price_type: string;

  @ValidateIf((o) => o.price_type === 'single')
  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price cannot be negative' })
  @IsNotEmpty({ message: 'price is required when price type is single' })
  price?: number;

  @ValidateIf((o) => o.price_type === 'multiple')
  @IsArray({ message: 'prices must be an array' })
  @IsNotEmpty({ message: 'prices is required when price type is multiple' })
  @ValidateNested({ each: true })
  @Type(() => ServicePriceDto)
  prices?: ServicePriceDto[];

  @Type(() => Number)
  @IsNumber({}, { message: 'Duration must be a number' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  duration: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  available_for_unlimited?: boolean;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each store must be a valid ID' })
  available_store_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each addon must be a valid service ID' })
  addon_ids?: string[];

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  public_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each include item must be a string' })
  include?: string[];

  @IsOptional()
  @IsBoolean()
  show_in_homepage?: boolean = false;

  @IsOptional()
  @IsNumber({}, { message: 'order must be a number' })
  order?: number = 0;

  @IsOptional()
  @IsEnum(['in home', 'in store'], {
    message: 'service location type must be either in home or in store',
  })
  service_location_type?: string = 'in store';

  @IsOptional()
  @IsBoolean({ message: 'is_pick_up_available must be a boolean' })
  is_pick_up_available?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean = true;

  @IsArray({ message: 'sessions must be an array' })
  @IsString({ each: true, message: 'Each session must be a string' })
  @IsNotEmpty({
    message: 'sessions is required and must contain at least 1 item',
  })
  sessions: string[];
}
