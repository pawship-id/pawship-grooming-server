import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZoneController } from './zone.controller';
import { ZoneService } from './zone.service';
import { Zone, ZoneSchema } from './entities/zone.entity';
import { AuthModule } from 'src/auth/auth.module';
import { Store, StoreSchema } from 'src/store/entities/store.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Zone.name, schema: ZoneSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
    AuthModule,
  ],
  controllers: [ZoneController],
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
