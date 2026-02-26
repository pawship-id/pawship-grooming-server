import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MediaType } from './booking.dto';

// DTO for media within a session
export class SessionMediaDto {
  @IsEnum(MediaType)
  @IsNotEmpty()
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  secure_url: string;

  @IsString()
  @IsNotEmpty()
  public_id: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsNotEmpty()
  created_by: {
    user_id: string;
    name_snapshot: string;
  };
}
