import { MongoloquentModule } from '@mongoloquent/nestjs';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/user/user.model';

@Module({
  imports: [
    MongoloquentModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET_KEY!,
      signOptions: { expiresIn: '3600s' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
