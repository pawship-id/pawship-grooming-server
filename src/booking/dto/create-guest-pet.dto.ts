import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateGuestPetDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  pet_name: string;

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
