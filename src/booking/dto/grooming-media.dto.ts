import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MediaType } from './booking.dto';

export class GroomingMediaDto {
  @IsEnum(MediaType, { message: 'type must be a valid MediaType' })
  @IsNotEmpty({ message: 'type is required' })
  type: MediaType;

  @IsMongoId({ message: 'user_id must be a valid ID' })
  @IsNotEmpty({ message: 'user_id is required' })
  user_id: string;

  @IsNotEmpty({ message: 'user_name is required' })
  @IsString()
  user_name: string;

  @IsOptional()
  @IsString()
  note?: string;
}
