import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongoloquentModule } from '@mongoloquent/nestjs';
import { User } from './user.model';

@Module({
  imports: [MongoloquentModule.forFeature([User])],
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
