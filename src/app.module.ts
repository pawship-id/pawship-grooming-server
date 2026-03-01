import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { ServiceTypeModule } from './service-type/service-type.module';
import { UploadFileModule } from './upload-file/upload-file.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

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
    ServiceTypeModule,
    UploadFileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
