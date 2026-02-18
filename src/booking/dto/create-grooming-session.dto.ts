import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroomingSessionStatus, MediaType } from './booking.dto';

export class GroomingMediaDto {
  @IsEnum(MediaType)
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  secure_url: string;

  @IsString()
  @IsNotEmpty()
  public_id: string;
}

export class CreateGroomingSessionDto {
  @IsOptional()
  @IsEnum(GroomingSessionStatus)
  status: GroomingSessionStatus;

  @IsOptional()
  @IsDateString()
  arrived_at?: string;

  @IsOptional()
  @IsDateString()
  started_at?: string;

  @IsOptional()
  @IsDateString()
  finished_at?: string;

  @IsOptional()
  @IsString()
  pre_conditions?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internal_note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroomingMediaDto)
  media?: GroomingMediaDto[];
}
