import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { Booking, BookingSchema } from 'src/booking/entities/booking.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageSchema,
} from 'src/booking/entities/store-daily-usage.entity';
import {
  Membership,
  MembershipSchema,
} from 'src/membership/entities/membership.entity';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipSchema,
} from 'src/pet-membership/entities/pet-membership.entity';
import { Store, StoreSchema } from 'src/store/entities/store.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacitySchema,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { DashboardController } from './dashboard.controller';
import { ActivityFeedService } from './services/activity-feed.service';
import { BookingsMetricsService } from './services/bookings-metrics.service';
import { CapacityService } from './services/capacity.service';
import { GroomerPerformanceService } from './services/groomer-performance.service';
import { GrowthService } from './services/growth.service';
import { MembershipHealthService } from './services/membership-health.service';
import { NeedsActionService } from './services/needs-action.service';
import { RevenueService } from './services/revenue.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Pet.name, schema: PetSchema },
      { name: PetMembership.name, schema: PetMembershipSchema },
      { name: Store.name, schema: StoreSchema },
      { name: StoreDailyCapacity.name, schema: StoreDailyCapacitySchema },
      { name: StoreDailyUsage.name, schema: StoreDailyUsageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    NeedsActionService,
    RevenueService,
    BookingsMetricsService,
    CapacityService,
    GroomerPerformanceService,
    ActivityFeedService,
    MembershipHealthService,
    GrowthService,
  ],
})
export class DashboardModule {}
