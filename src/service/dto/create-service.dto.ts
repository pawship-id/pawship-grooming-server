import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServicePriceDto {
  @IsOptional()
  @IsMongoId({ message: 'pet must be a valid ID' })
  pet_id?: string;

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
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  pet_type_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each size category must be a valid ID' })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  size_category_ids?: string[];

  @IsOptional()
  @IsArray({ message: 'prices must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ServicePriceDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
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
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  available_store_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each addon must be a valid service ID' })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  addon_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each include item must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  include?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean = true;
}
