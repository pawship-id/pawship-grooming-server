import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BenefitUsageService } from './benefit-usage.service';
import {
  BenefitUsage,
  BenefitUsageSchema,
} from './entities/benefit-usage.entity';
import {
  PetMembership,
  PetMembershipSchema,
} from '../pet-membership/entities/pet-membership.entity';
import { AuthModule } from 'src/auth/auth.module';
import { BenefitUsageController } from './benefit-usage.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BenefitUsage.name, schema: BenefitUsageSchema },
      { name: PetMembership.name, schema: PetMembershipSchema },
    ]),
    AuthModule,
  ],
  controllers: [BenefitUsageController],
  providers: [BenefitUsageService],
  exports: [BenefitUsageService],
})
export class BenefitUsageModule {}
