import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MediaType } from './booking.dto';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'type is required' })
  type: string;

  @IsOptional()
  @IsMongoId({ message: 'groomer_id must be a valid Mongo ID' })
  groomer_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

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
