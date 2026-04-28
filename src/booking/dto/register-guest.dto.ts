import { Type } from 'class-transformer';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class GuestPetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  pet_type_id: string;

  @IsMongoId()
  @IsOptional()
  breed_category_id?: string;

  @IsMongoId()
  @IsNotEmpty()
  size_category_id: string;

  @IsMongoId()
  @IsNotEmpty()
  hair_category_id: string;
}

export class RegisterGuestDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
  phone_number: string;

  @ValidateNested()
  @Type(() => GuestPetDto)
  @IsNotEmpty()
  pet: GuestPetDto;
}
