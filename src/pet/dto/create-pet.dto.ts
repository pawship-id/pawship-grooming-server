import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class ProfileImageDto {
  @IsOptional() secure_url?: string;
  @IsOptional() public_id?: string;
}

export class CreatePetDto {
  @IsNotEmpty({ message: 'pet name membership is required' })
  name: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  internal_note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileImageDto)
  profile_image?: ProfileImageDto;

  @IsMongoId({ message: 'pet type must be a valid ID' })
  @IsNotEmpty({ message: 'pet type is required' })
  pet_type_id: string;

  @IsMongoId({ message: 'hair category must be a valid ID' })
  @IsOptional()
  hair_category_id?: string;

  @IsOptional()
  birthday?: Date;

  @IsMongoId({ message: 'pet size must be a valid ID' })
  @IsNotEmpty({ message: 'pet size is required' })
  size_category_id: string;

  @IsMongoId({ message: 'pet breed must be a valid ID' })
  @IsNotEmpty({ message: 'pet breed is required' })
  breed_category_id: string;

  @IsOptional()
  weight: number;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  last_grooming_at?: Date;

  @IsOptional()
  last_visit_at?: Date;

  @IsMongoId({ message: 'pet owner must be a valid ID' })
  @IsNotEmpty({ message: 'pet owner is required' })
  customer_id: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
