import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum UserRole {
  ADMIN = 'admin',
  OPS = 'ops',
  GROOMER = 'groomer',
  CUSTOMER = 'customer',
}

export class CreateUserDto {
  @IsNotEmpty({ message: 'username is required' })
  username: string;

  @IsEmail({}, { message: 'invalid email format' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @IsNotEmpty({ message: 'phone number is required' })
  phone_number: string;

  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsNotEmpty({ message: 'password is required' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'role must be admin | ops | groomer | customer',
  })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class GetUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'role must be admin | ops | groomer | customer',
  })
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;
}

export class ToggleUserStatusDto {
  @IsNotEmpty({ message: 'is_active is required' })
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active: boolean;
}
