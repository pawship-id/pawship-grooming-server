import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import {
  Membership,
  MembershipSchema,
} from 'src/membership/entities/membership.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { Promotion, PromotionSchema } from './entities/promotion.entity';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
    AuthModule,
  ],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
