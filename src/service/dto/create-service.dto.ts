import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServicePriceDto {
  @IsMongoId({ message: 'size must be a valid ID' })
  @IsNotEmpty({ message: 'size is required' })
  size_id: string;

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
  description: string;

  @IsMongoId({ message: 'service type must be a valid ID' })
  @IsNotEmpty({ message: 'service type is required' })
  service_type_id: string;

  @IsArray()
  @IsMongoId({ each: true, message: 'Each pet type must be a valid ID' })
  @IsOptional()
  pet_type_ids?: string[];

  @IsMongoId({ message: 'size category pet must be a valid ID' })
  @IsNotEmpty({ message: 'size category pet is required' })
  size_category_id: string;

  @IsArray({ message: 'prices must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ServicePriceDto)
  @IsNotEmpty({ message: 'prices is required' })
  prices: ServicePriceDto[];

  @Type(() => Number)
  @IsNumber({}, { message: 'Duration must be a number' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  duration: number;

  @IsOptional()
  available_for_unlimited?: boolean;

  @IsArray()
  @IsMongoId({ each: true, message: 'Each store must be a valid ID' })
  @IsOptional()
  available_store_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
