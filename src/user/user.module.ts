import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './entities/user.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { PetModule } from 'src/pet/pet.module';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipSchema,
} from 'src/pet-membership/entities/pet-membership.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Pet.name, schema: PetSchema }]),
    MongooseModule.forFeature([
      { name: PetMembership.name, schema: PetMembershipSchema },
    ]),
    AuthModule,
    PetModule,
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
