import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Store, StoreSchema } from './entities/store.entity';
import { AuthModule } from 'src/auth/auth.module';
import {
  StoreDailyCapacity,
  StoreDailyCapacitySchema,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: StoreDailyCapacity.name, schema: StoreDailyCapacitySchema },
    ]),
    AuthModule,
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
