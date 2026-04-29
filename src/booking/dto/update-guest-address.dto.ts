import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GuestAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  subdistrict?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  is_main_address?: boolean;
}

export class UpdateGuestAddressDto {
  @IsNotEmpty({ message: 'phone_number is required' })
  @IsString()
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
  phone_number: string;

  @IsOptional()
  @IsMongoId()
  address_id?: string;

  @ValidateNested()
  @Type(() => GuestAddressDto)
  address: GuestAddressDto;
}
