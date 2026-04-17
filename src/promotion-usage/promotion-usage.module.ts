import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import {
  PromotionUsage,
  PromotionUsageSchema,
} from './entities/promotion-usage.entity';
import { PromotionUsageService } from './promotion-usage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromotionUsage.name, schema: PromotionUsageSchema },
    ]),
    AuthModule,
  ],
  providers: [PromotionUsageService],
  exports: [PromotionUsageService],
})
export class PromotionUsageModule {}
