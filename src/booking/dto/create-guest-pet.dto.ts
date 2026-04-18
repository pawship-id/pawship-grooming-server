import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsOptional()
  breed_category_id?: string;

  @IsMongoId()
  @IsNotEmpty()
  size_category_id: string;

  @IsMongoId()
  @IsNotEmpty()
  hair_category_id: string;
}
