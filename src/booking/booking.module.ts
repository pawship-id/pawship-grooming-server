import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { Booking, BookingSchema } from './entities/booking.entity';
import { PetModule } from 'src/pet/pet.module';
import { ServiceModule } from 'src/service/service.module';
import { StoreModule } from 'src/store/store.module';
import { Store, StoreSchema } from 'src/store/entities/store.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { AuthModule } from 'src/auth/auth.module';
import {
  StoreDailyUsage,
  StoreDailyUsageSchema,
} from './entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacitySchema,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { GuestService } from './guest.service';
import { OptionModule } from 'src/option/option.module';
import { UserService } from 'src/user/user.service';
import { PetMembershipModule } from 'src/pet-membership/pet-membership.module';
import { BenefitUsageModule } from 'src/benefit-usage/benefit-usage.module';
import { PromotionModule } from 'src/promotion/promotion.module';
import {
  Promotion,
  PromotionSchema,
} from 'src/promotion/entities/promotion.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
      { name: Pet.name, schema: PetSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Store.name, schema: StoreSchema },
      { name: StoreDailyUsage.name, schema: StoreDailyUsageSchema },
      { name: StoreDailyCapacity.name, schema: StoreDailyCapacitySchema },
      { name: Promotion.name, schema: PromotionSchema },
    ]),
    PetModule,
    ServiceModule,
    StoreModule,
    CloudinaryModule,
    AuthModule,
    OptionModule,
    PetMembershipModule,
    BenefitUsageModule,
    PromotionModule,
  ],
  controllers: [BookingController, SessionController],
  providers: [BookingService, SessionService, GuestService, UserService],
  exports: [BookingService],
})
export class BookingModule {}
