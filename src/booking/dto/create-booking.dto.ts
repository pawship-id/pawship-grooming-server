import { Type } from 'class-transformer';
import {
  IsArray,
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

export class PetSnapshotDto {
  @IsOptional()
  _id?: string;

  @IsOptional()
  @IsString()
  name: string;

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

export class AssignedGroomerDto {
  @IsString()
  task: string;

  @IsMongoId({ message: 'groomer_id must be a valid Mongo ID' })
  groomer_id: string;
}

export class CreateBookingDto {
  @IsMongoId({ message: 'service type must be a valid ID' })
  @IsNotEmpty({ message: 'service type is required' })
  service_type_id: string;

  @IsMongoId({ message: 'customer must be a valid ID' })
  @IsNotEmpty({ message: 'customer is required' })
  customer_id: string;

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
  @ValidateNested({ each: true })
  @Type(() => AssignedGroomerDto)
  assigned_groomers?: AssignedGroomerDto[];

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
