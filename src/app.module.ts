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
import { PetMembershipModule } from './pet-membership/pet-membership.module';
import { BenefitUsageModule } from './benefit-usage/benefit-usage.module';
import { PetModule } from './pet/pet.module';
import { BookingModule } from './booking/booking.module';
import { StoreDailyCapacityModule } from './store-daily-capacity/store-daily-capacity.module';
import { ServiceTypeModule } from './service-type/service-type.module';
import { UploadFileModule } from './upload-file/upload-file.module';
import { BannerModule } from './banner/banner.module';
import { PromotionModule } from './promotion/promotion.module';
import { PromotionUsageModule } from './promotion-usage/promotion-usage.module';
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
    PetMembershipModule,
    BenefitUsageModule,
    PetModule,
    BookingModule,
    StoreDailyCapacityModule,
    ServiceTypeModule,
    UploadFileModule,
    BannerModule,
    PromotionModule,
    PromotionUsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
