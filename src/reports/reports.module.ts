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
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
