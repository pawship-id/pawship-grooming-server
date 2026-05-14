import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OperationsReportDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  store_id?: string;

  /** Maps to Booking.booking_status */
  @IsOptional()
  @IsString()
  booking_status?: string;

  /** Maps to Booking.type — 'in store' | 'in home' */
  @IsOptional()
  @IsString()
  booking_type?: string;

  /** Filter bookings where at least one session has this status — 'not_started' | 'in_progress' | 'finished' */
  @IsOptional()
  @IsString()
  session_status?: string;

  /** Filter by service_snapshot.service_type.title — e.g. 'Grooming' | 'Hotel' | 'Add-on' */
  @IsOptional()
  @IsString()
  service_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  limit?: number;
}
