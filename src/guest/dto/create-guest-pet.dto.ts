import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateGuestPetDto {
  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  pet_name: string;

  @IsMongoId()
  @IsNotEmpty()
  pet_type_id: string;

  @IsMongoId()
  @IsNotEmpty()
  breed_category_id: string;

  @IsMongoId()
  @IsNotEmpty()
  size_category_id: string;
}
