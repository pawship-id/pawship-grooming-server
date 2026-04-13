import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetServicesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  available_for_unlimited?: boolean;

  @IsOptional()
  @IsMongoId()
  service_type_id?: string;

  @IsOptional()
  @IsMongoId()
  pet_type_id?: string;

  @IsOptional()
  @IsMongoId()
  size_category_id?: string;

  @IsOptional()
  @IsMongoId()
  store_id?: string;

  @IsOptional()
  @IsEnum(['in home', 'in store'], {
    message: 'service_location_type must be either in home or in store',
  })
  service_location_type?: string;
}
