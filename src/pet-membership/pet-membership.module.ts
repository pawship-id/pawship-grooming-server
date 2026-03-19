import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetMembershipService } from './pet-membership.service';
import {
  PetMembership,
  PetMembershipSchema,
} from './entities/pet-membership.entity';
import {
  Membership,
  MembershipSchema,
} from '../membership/entities/membership.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PetMembershipController } from './pet-membership.controller';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PetMembership.name, schema: PetMembershipSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    AuthModule,
  ],
  controllers: [PetMembershipController],
  providers: [PetMembershipService],
  exports: [PetMembershipService],
})
export class PetMembershipModule {}
