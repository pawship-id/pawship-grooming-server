import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { MediaType } from './booking.dto';

export class GroomingMediaDto {
  @IsEnum(MediaType, { message: 'type must be a valid MediaType' })
  @IsNotEmpty({ message: 'type is required' })
  type: MediaType;

  @IsOptional()
  @IsString()
  notes?: string;

  /** @deprecated Use `notes` instead. Kept so older clients keep working. */
  @IsOptional()
  @IsString()
  note?: string;
}

export class RequestMediaSignatureDto {
  @IsEnum(MediaType, { message: 'type must be a valid MediaType' })
  @IsNotEmpty({ message: 'type is required' })
  type: MediaType;
}

export class ConfirmMediaUploadDto {
  @IsEnum(MediaType, { message: 'type must be a valid MediaType' })
  @IsNotEmpty({ message: 'type is required' })
  type: MediaType;

  @IsString()
  @IsNotEmpty({ message: 'public_id is required' })
  public_id: string;

  @IsUrl({ require_protocol: true }, { message: 'secure_url must be a valid URL' })
  secure_url: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** @deprecated Use `notes` instead. */
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmSessionOtherMediaUploadDto {
  @IsString()
  @IsNotEmpty({ message: 'public_id is required' })
  public_id: string;

  @IsUrl({ require_protocol: true }, { message: 'secure_url must be a valid URL' })
  secure_url: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** @deprecated Use `notes` instead. */
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateMediaNotesDto {
  @IsString()
  @IsNotEmpty({ message: 'public_id is required' })
  public_id: string;

  // Caption text. Empty string clears the note.
  @IsOptional()
  @IsString()
  notes?: string;
}
