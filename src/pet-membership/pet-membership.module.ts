import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetMembershipService } from './pet-membership.service';
import {
  PetMembership,
  PetMembershipSchema,
} from './entities/pet-membership.entity';
import {
  MembershipLog,
  MembershipLogSchema,
} from './entities/membership-log.entity';
import {
  Membership,
  MembershipSchema,
} from '../membership/entities/membership.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PetMembershipController } from './pet-membership.controller';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { BenefitUsageModule } from 'src/benefit-usage/benefit-usage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PetMembership.name, schema: PetMembershipSchema },
      { name: MembershipLog.name, schema: MembershipLogSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    AuthModule,
    BenefitUsageModule,
  ],
  controllers: [PetMembershipController],
  providers: [PetMembershipService],
  exports: [PetMembershipService],
})
export class PetMembershipModule {}
