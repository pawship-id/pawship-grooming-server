import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { MembershipStatus } from './pet.dto';

export class MembershipItemDto {
  @IsMongoId({ message: 'membership must be a valid ID' })
  @IsNotEmpty({ message: 'membership is required' })
  membership_id: string;

  @IsNotEmpty({ message: 'start date is required' })
  start_date: Date;

  @IsNotEmpty({ message: 'end date is required' })
  end_date: Date;

  @IsEnum(MembershipStatus, {
    each: true,
    message: 'status must be in the options',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: string;

  @IsOptional()
  usage_count: number;

  @IsOptional()
  max_usage: number;
}

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

  @IsMongoId({ message: 'feather category must be a valid ID' })
  @IsOptional()
  feather_category_id?: string;

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

  @IsMongoId({ message: 'member category must be a valid ID' })
  @IsOptional()
  member_category_id?: string;

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
  @ValidateNested()
  @Type(() => MembershipItemDto)
  memberships?: MembershipItemDto[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
