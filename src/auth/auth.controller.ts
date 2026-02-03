import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body('username') username: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!username) throw new BadRequestException('username is required');
    if (!email) throw new BadRequestException('name is required');
    if (!password) throw new BadRequestException('password is required');

    await this.authService.createUser({
      username,
      email,
      password,
    });

    return {
      message: 'Successfully Created',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!email) throw new BadRequestException('email is required');
    if (!password) throw new BadRequestException('password is required');

    const token = await this.authService.signIn(email, password);

    return {
      message: 'login berhasil',
      token,
    };
  }
}
