import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { OptionModule } from './option/option.module';
import { UserModule } from './user/user.module';
import { StoreModule } from './store/store.module';
import { ServiceModule } from './service/service.module';
import { MembershipModule } from './membership/membership.module';
import { PetModule } from './pet/pet.module';
import { BookingModule } from './booking/booking.module';
import { GuestModule } from './guest/guest.module';
import { StoreDailyCapacityModule } from './store-daily-capacity/store-daily-capacity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DATABASE_NAME'),
      }),
    }),
    AuthModule,
    UserModule,
    OptionModule,
    StoreModule,
    ServiceModule,
    MembershipModule,
    PetModule,
    BookingModule,
    GuestModule,
    StoreDailyCapacityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
