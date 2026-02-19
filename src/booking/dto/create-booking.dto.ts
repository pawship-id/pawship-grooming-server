import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BookingStatus, GroomingType, MediaType } from './booking.dto';

export class PetSnapshotDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  member_type?: string;
}

export class BookingStatusLogDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsNotEmpty()
  timestamp: Date;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateBookingDto {
  @IsMongoId({ message: 'customer must be a valid ID' })
  @IsNotEmpty({ message: 'customer is required' })
  customer_id: string;

  @IsMongoId({ message: 'pet must be a valid ID' })
  @IsNotEmpty({ message: 'pet is required' })
  pet_id: string;

  @ValidateNested()
  @Type(() => PetSnapshotDto)
  pet_snapshot: PetSnapshotDto;

  @IsOptional()
  @IsMongoId({ message: 'store must be a valid ID' })
  store_id?: string;

  @IsNotEmpty({ message: 'date booking is required' })
  date: Date;

  @IsString()
  time_range: string;

  @IsEnum(GroomingType)
  type: GroomingType;

  @IsOptional()
  @IsEnum(BookingStatus)
  booking_status?: BookingStatus;

  @IsMongoId({ message: 'service must be a valid ID' })
  @IsNotEmpty({ message: 'service is required' })
  service_id: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each add on must be a valid ID' })
  service_addon_ids?: string[];

  @IsOptional()
  travel_fee?: number;

  @IsOptional()
  sub_total_service: number;

  @IsOptional()
  total_price: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each discount on must be a valid ID' })
  discount_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each groomer on must be a valid ID' })
  assigned_groomer_ids?: string[];

  @IsOptional()
  @IsString()
  referal_code?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingStatusLogDto)
  status_logs?: BookingStatusLogDto[];
}
