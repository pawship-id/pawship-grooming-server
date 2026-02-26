import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/user.model';
import { Pet, PetSchema } from 'src/pet/entities/pet.entity';
import { BookingModule } from 'src/booking/booking.module';
import { StoreModule } from 'src/store/store.module';
import { ServiceModule } from 'src/service/service.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Pet.name, schema: PetSchema },
    ]),
    BookingModule,
    StoreModule,
    ServiceModule,
  ],
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
