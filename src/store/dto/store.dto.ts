import { IsOptional, IsEnum, IsArray } from 'class-validator';

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
  @IsOptional() max_booking_per_day?: number;
  @IsOptional() max_booking_per_slot?: number;
  @IsOptional() slot_duration_minutes?: number;
}
