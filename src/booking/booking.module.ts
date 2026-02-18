import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/user.model';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { Booking, BookingSchema } from './entities/booking.entity';
import { PetModule } from 'src/pet/pet.module';
import { ServiceModule } from 'src/service/service.module';
import { Store, StoreSchema } from 'src/store/entities/store.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
      { name: Pet.name, schema: PetSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
    PetModule,
    ServiceModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
