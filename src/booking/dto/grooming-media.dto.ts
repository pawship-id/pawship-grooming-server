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

  @IsOptional()
  @IsString()
  note?: string;
}
