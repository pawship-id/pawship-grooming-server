import {
  IsOptional,
  IsEnum,
  IsArray,
  isNotEmpty,
  IsNotEmpty,
  IsNumber,
  Min,
  IsMongoId,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

export class LocationDto {
  @IsOptional() address?: string;
  @IsOptional() city?: string;
  @IsOptional() province?: string;
  @IsOptional() postal_code?: string;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
}

export class ContactDto {
  @IsOptional() phone_number?: string;
  @IsOptional() whatsapp?: string;
  @IsOptional() email?: string;
}

export class OperationalDto {
  @IsOptional() opening_time?: string;
  @IsOptional() closing_time?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, {
    each: true,
    message:
      'operational day must be monday | tuesday | wednesday | thursday | friday | saturday | sunday',
  })
  operational_days?: DayOfWeek[];

  @IsOptional() timezone?: string = 'Asia/Jakarta';
}

export class CapacityDto {
  @IsNotEmpty({ message: 'daily capacity minutes is required' })
  default_daily_capacity_minutes: number;

  @IsNotEmpty({
    message: 'overbooking limit minutes is required',
  })
  overbooking_limit_minutes: number;
}

export class ZonePriceItemDto {
  @IsNotEmpty({ message: 'size_category_id is required' })
  @IsMongoId({ message: 'size_category_id must be a valid MongoDB ObjectId' })
  size_category_id: string;

  @IsNotEmpty({ message: 'price is required' })
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price must be at least 0' })
  price: number;
}

export class HomeServiceZoneDto {
  @IsNotEmpty({ message: 'area_name is required' })
  area_name: string;

  @IsNotEmpty({ message: 'min_radius_km is required' })
  @IsNumber({}, { message: 'min_radius_km must be a number' })
  @Min(0, { message: 'min_radius_km must be at least 0' })
  min_radius_km: number;

  @IsNotEmpty({ message: 'max_radius_km is required' })
  @IsNumber({}, { message: 'max_radius_km must be a number' })
  @Min(0, { message: 'max_radius_km must be at least 0' })
  max_radius_km: number;

  @IsNotEmpty({ message: 'travel_time_minutes is required' })
  @IsNumber({}, { message: 'travel_time_minutes must be a number' })
  @Min(0, { message: 'travel_time_minutes must be at least 0' })
  travel_time_minutes: number;

  @IsNotEmpty({ message: 'price is required' })
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price must be at least 0' })
  price: number;
}

export class PickupDeliveryZoneDto {
  @IsNotEmpty({ message: 'area_name is required' })
  area_name: string;

  @IsNotEmpty({ message: 'min_radius_km is required' })
  @IsNumber({}, { message: 'min_radius_km must be a number' })
  @Min(0, { message: 'min_radius_km must be at least 0' })
  min_radius_km: number;

  @IsNotEmpty({ message: 'max_radius_km is required' })
  @IsNumber({}, { message: 'max_radius_km must be a number' })
  @Min(0, { message: 'max_radius_km must be at least 0' })
  max_radius_km: number;

  @IsNotEmpty({ message: 'travel_time_minutes is required' })
  @IsNumber({}, { message: 'travel_time_minutes must be a number' })
  @Min(0, { message: 'travel_time_minutes must be at least 0' })
  travel_time_minutes: number;

  @IsNotEmpty({ message: 'prices is required' })
  @IsArray({ message: 'prices must be an array' })
  @ArrayMinSize(1, { message: 'prices must contain at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => ZonePriceItemDto)
  prices: ZonePriceItemDto[];
}

/** @deprecated Use HomeServiceZoneDto instead */
export class ZoneItemDto {
  @IsNotEmpty({ message: 'area_name is required' })
  area_name: string;

  @IsNotEmpty({ message: 'min_radius_km is required' })
  @IsNumber({}, { message: 'min_radius_km must be a number' })
  @Min(0, { message: 'min_radius_km must be at least 0' })
  min_radius_km: number;

  @IsNotEmpty({ message: 'max_radius_km is required' })
  @IsNumber({}, { message: 'max_radius_km must be a number' })
  @Min(0, { message: 'max_radius_km must be at least 0' })
  max_radius_km: number;

  @IsNotEmpty({ message: 'travel_time_minutes is required' })
  @IsNumber({}, { message: 'travel_time_minutes must be a number' })
  @Min(0, { message: 'travel_time_minutes must be at least 0' })
  travel_time_minutes: number;

  @IsNotEmpty({ message: 'travel_fee is required' })
  @IsNumber({}, { message: 'travel_fee must be a number' })
  @Min(0, { message: 'travel_fee must be at least 0' })
  travel_fee: number;
}
