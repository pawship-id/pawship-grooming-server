import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from './user.dto';

export class CreateUserDto {
  @IsNotEmpty({ message: 'username is required' })
  username: string;

  @IsOptional()
  @Transform(({ value }) => (value && value.trim() !== '' ? value : undefined))
  @IsEmail({}, { message: 'invalid email format' })
  email?: string;

  @IsNotEmpty({ message: 'phone number is required' })
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
  phone_number: string;

  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'role must be admin | ops | groomer | customer',
  })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_idle?: boolean;
}
