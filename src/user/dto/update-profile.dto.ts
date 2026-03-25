import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Gender } from '../entities/user.entity';

export class UpdateAddressDto {
  @IsOptional()
  @IsString({ message: 'label must be a string' })
  label?: string;

  @IsOptional()
  @IsString({ message: 'street must be a string' })
  street?: string;

  @IsOptional()
  @IsString({ message: 'subdistrict must be a string' })
  subdistrict?: string;

  @IsOptional()
  @IsString({ message: 'district must be a string' })
  district?: string;

  @IsOptional()
  @IsString({ message: 'city must be a string' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'province must be a string' })
  province?: string;

  @IsOptional()
  @IsString({ message: 'postal_code must be a string' })
  postal_code?: string;

  @IsOptional()
  @IsString({ message: 'note must be a string' })
  note?: string;

  @IsOptional()
  @IsNumber({}, { message: 'latitude must be a number' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'longitude must be a number' })
  longitude?: number;

  @IsOptional()
  is_main_address?: boolean;
}

/**
 * Fields available per role (email cannot be updated here):
 *   admin / ops : full_name, image_url, public_id, gender, placement, tags, address
 *   groomer     : above + groomer_skills, groomer_rating
 *   customer    : full_name, image_url, public_id, gender, customer_category_id, tags, address
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'full_name must be a string' })
  full_name?: string;

  @IsOptional()
  @IsString({ message: 'image_url must be a string' })
  image_url?: string;

  @IsOptional()
  @IsString({ message: 'public_id must be a string' })
  public_id?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'gender must be Male or Female' })
  gender?: Gender;

  /** Admin / Ops / Groomer — Store ObjectId */
  @IsOptional()
  @IsMongoId({ message: 'placement must be a valid store ID' })
  placement?: string;

  /** Groomer only */
  @IsOptional()
  @IsArray({ message: 'groomer_skills must be an array' })
  @IsString({ each: true, message: 'each groomer skill must be a string' })
  groomer_skills?: string[];

  @IsOptional()
  @IsNumber({}, { message: 'groomer_rating must be a number' })
  @Min(0, { message: 'groomer_rating must be at least 0' })
  groomer_rating?: number;

  /** Customer only — Option ObjectId */
  @IsOptional()
  @IsMongoId({ message: 'customer_category_id must be a valid option ID' })
  customer_category_id?: string;

  @IsOptional()
  @IsArray({ message: 'tags must be an array' })
  @IsString({ each: true, message: 'each tag must be a string' })
  tags?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddressDto)
  addresses?: UpdateAddressDto[];
}
