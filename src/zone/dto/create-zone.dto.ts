import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateZoneDto {
  @IsNotEmpty()
  @IsMongoId()
  store_id: string;

  @IsNotEmpty()
  @IsString()
  area_name: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_radius_km: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_radius_km: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travel_time_minutes: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travel_fee: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
