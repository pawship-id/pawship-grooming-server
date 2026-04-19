import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { Public } from './public.decorator';
import {
  CheckPhoneDto,
  RefreshTokenDto,
  SendPasswordSetupDto,
  SetPasswordDto,
  VerifySetupTokenDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: CreateUserDto) {
    await this.authService.createUser(body);

    return {
      message: 'Successfully Created',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!email) throw new BadRequestException('email is required');
    if (!password) throw new BadRequestException('password is required');

    const tokens = await this.authService.signIn(email, password);

    return {
      message: 'login berhasil',
      ...tokens,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(body.refresh_token);

    return {
      message: 'token refreshed successfully',
      ...tokens,
    };
  }

  @Public()
  @Post('check-phone')
  @HttpCode(HttpStatus.OK)
  async checkPhone(@Body() body: CheckPhoneDto) {
    const result = await this.authService.checkPhone(body.phone_number);
    return result;
  }

  @Public()
  @Post('send-password-setup')
  @HttpCode(HttpStatus.OK)
  async sendPasswordSetup(@Body() body: SendPasswordSetupDto) {
    const result = await this.authService.sendPasswordSetup(
      body.phone_number,
      body.email,
    );
    return result;
  }

  @Public()
  @Post('verify-setup-token')
  @HttpCode(HttpStatus.OK)
  async verifySetupToken(@Body() body: VerifySetupTokenDto) {
    const result = await this.authService.verifySetupToken(body.token);
    return result;
  }

  @Public()
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  async setPassword(@Body() body: SetPasswordDto) {
    const result = await this.authService.setPassword(
      body.token,
      body.password,
    );
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: any) {
    const userId = request.user?._id;
    if (!userId) {
      throw new BadRequestException('user is required');
    }

    await this.authService.revokeRefreshToken(userId);

    return {
      message: 'logout successfully',
    };
  }
}
