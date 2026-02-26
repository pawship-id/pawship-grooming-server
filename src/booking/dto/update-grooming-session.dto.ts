import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { SessionStatus } from './booking.dto';

// DTO for updating a specific session by ID
export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsMongoId()
  groomer_id?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsDateString()
  started_at?: string;

  @IsOptional()
  @IsDateString()
  finished_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internal_note?: string;
}

// DTO for finishing a specific session
export class FinishSessionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
