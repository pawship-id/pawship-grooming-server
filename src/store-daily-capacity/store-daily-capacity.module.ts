import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreDailyCapacityController } from './store-daily-capacity.controller';
import { StoreDailyCapacityService } from './store-daily-capacity.service';
import {
  StoreDailyCapacity,
  StoreDailyCapacitySchema,
} from './entities/store-daily-capacity.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreDailyCapacity.name, schema: StoreDailyCapacitySchema },
    ]),
    AuthModule,
  ],
  controllers: [StoreDailyCapacityController],
  providers: [StoreDailyCapacityService],
  exports: [StoreDailyCapacityService],
})
export class StoreDailyCapacityModule {}
