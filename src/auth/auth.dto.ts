import { IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({ message: 'refresh_token is required' })
  refresh_token: string;
}
