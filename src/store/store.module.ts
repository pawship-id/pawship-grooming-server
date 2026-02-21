import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Store, StoreSchema } from './entities/store.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }]),
    AuthModule,
  ],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
