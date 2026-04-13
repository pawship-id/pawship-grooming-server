import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BookingStatus, GroomingType } from './booking.dto';
import { CreateSessionDto } from './create-grooming-session.dto';

export class PetSnapshotDto {
  @IsOptional()
  _id?: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internal_note?: string;

  @IsOptional()
  @ValidateIf((o) => o.member_type !== null)
  @IsObject()
  member_type?: { _id: string; name: string } | null;

  @IsOptional()
  @IsObject()
  pet_type: { _id: string; name: string };

  @IsOptional()
  @IsObject()
  size: { _id: string; name: string };

  @IsOptional()
  @IsObject()
  hair: { _id: string; name: string };

  @IsOptional()
  @IsObject()
  breed: { _id: string; name: string };
}

export class ServiceSnapshotAddonDto {
  @IsOptional()
  _id?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  duration?: number;
}

export class ServiceSnapshotDto {
  @IsOptional()
  _id?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  service_type?: { _id: string; title: string };

  @IsOptional()
  price?: number;

  @IsOptional()
  duration?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceSnapshotAddonDto)
  addons?: ServiceSnapshotAddonDto[];
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
  @IsMongoId({ message: 'service type must be a valid ID' })
  @IsNotEmpty({ message: 'service type is required' })
  service_type_id: string;

  @IsMongoId({ message: 'customer must be a valid ID' })
  @IsOptional()
  customer_id?: string;

  @IsMongoId({ message: 'pet must be a valid ID' })
  @IsNotEmpty({ message: 'pet is required' })
  pet_id: string;

  @ValidateNested()
  @Type(() => PetSnapshotDto)
  pet_snapshot: PetSnapshotDto;

  @ValidateNested()
  @Type(() => ServiceSnapshotDto)
  service_snapshot: ServiceSnapshotDto;

  @IsMongoId({ message: 'store must be a valid ID' })
  @IsNotEmpty({ message: 'store is required' })
  store_id: string;

  @IsNotEmpty({ message: 'date booking is required' })
  date: Date;

  @IsString()
  time_range: string;

  @IsOptional()
  @IsEnum(GroomingType)
  type?: GroomingType;

  @IsOptional()
  @IsEnum(BookingStatus)
  booking_status: BookingStatus;

  @IsMongoId({ message: 'service must be a valid ID' })
  @IsNotEmpty({ message: 'service is required' })
  service_id: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each add on must be a valid ID' })
  service_addon_ids?: string[];

  @IsOptional()
  travel_fee: number;

  @IsOptional()
  sub_total_service: number;

  @IsOptional()
  original_total_price: number;

  @IsOptional()
  total_discount?: number;

  @IsOptional()
  final_total_price?: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each discount on must be a valid ID' })
  discount_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSessionDto)
  sessions?: CreateSessionDto[];

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

  @IsOptional()
  @IsBoolean({ message: 'pick_up must be a boolean' })
  pick_up?: boolean = false;

  @IsOptional()
  @IsBoolean({ message: 'delivery must be a boolean' })
  delivery?: boolean = false;

  @IsOptional()
  @IsArray({ message: 'selected_benefit_ids must be an array' })
  @IsMongoId({
    each: true,
    message: 'each benefit ID must be a valid MongoDB ID',
  })
  selected_benefit_ids?: string[];
}
