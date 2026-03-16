import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from './booking.dto';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  date?: Date;

  @IsOptional()
  time_range?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
