import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({ message: 'refresh_token is required' })
  refresh_token: string;
}

export class CheckPhoneDto {
  @IsNotEmpty({ message: 'phone_number is required' })
  phone_number: string;
}

export class SendPasswordSetupDto {
  @IsNotEmpty({ message: 'phone_number is required' })
  phone_number: string;

  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

export class VerifySetupTokenDto {
  @IsNotEmpty({ message: 'token is required' })
  token: string;
}

export class SetPasswordDto {
  @IsNotEmpty({ message: 'token is required' })
  token: string;

  @IsNotEmpty({ message: 'password is required' })
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;
}
