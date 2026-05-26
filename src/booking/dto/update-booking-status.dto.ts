import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from './booking.dto';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  date?: Date;

  // Hotel reschedule: new check-out date. Required when rescheduling a hotel
  // booking; ignored for non-hotel services.
  @IsOptional()
  end_date?: Date;

  @IsOptional()
  time_range?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  cancellation_reason?: string;
}
