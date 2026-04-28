import { IsEmail, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({ message: 'refresh_token is required' })
  refresh_token: string;
}

export class CheckPhoneDto {
  @IsNotEmpty({ message: 'phone_number is required' })
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
  phone_number: string;
}

export class SendPasswordSetupDto {
  @IsNotEmpty({ message: 'phone_number is required' })
  @Matches(/^0\d+$/, {
    message:
      'Phone number must start with 0 and contain digits only (e.g. 08xxx)',
  })
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
