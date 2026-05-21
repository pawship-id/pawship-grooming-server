import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { Booking, BookingSchema } from 'src/booking/entities/booking.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageSchema,
} from 'src/booking/entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacitySchema,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { Store, StoreSchema } from 'src/store/entities/store.entity';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipSchema,
} from 'src/pet-membership/entities/pet-membership.entity';
import {
  Membership,
  MembershipSchema,
} from 'src/membership/entities/membership.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { Option, OptionSchema } from 'src/option/entities/option.entity';
import {
  BenefitUsage,
  BenefitUsageSchema,
} from 'src/benefit-usage/entities/benefit-usage.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import {
  MembershipLog,
  MembershipLogSchema,
} from 'src/pet-membership/entities/membership-log.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: StoreDailyUsage.name, schema: StoreDailyUsageSchema },
      { name: StoreDailyCapacity.name, schema: StoreDailyCapacitySchema },
      { name: Store.name, schema: StoreSchema },
      { name: Pet.name, schema: PetSchema },
      { name: PetMembership.name, schema: PetMembershipSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: Option.name, schema: OptionSchema },
      { name: BenefitUsage.name, schema: BenefitUsageSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: MembershipLog.name, schema: MembershipLogSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
