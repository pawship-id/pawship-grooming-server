import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './entities/service.entity';
import { Option, OptionSchema } from 'src/option/entities/option.entity';
import { Store, StoreSchema } from 'src/store/entities/store.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Option.name, schema: OptionSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
    AuthModule,
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
