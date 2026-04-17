import { Type } from 'class-transformer';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  phone_number: string;

  @ValidateNested()
  @Type(() => GuestPetDto)
  @IsNotEmpty()
  pet: GuestPetDto;
}
