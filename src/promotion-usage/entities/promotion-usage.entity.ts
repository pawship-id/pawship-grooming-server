import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PromotionLimitType,
  PromotionUsagePeriod,
} from 'src/promotion/dto/create-promotion.dto';

export type PromotionUsageDocument = HydratedDocument<PromotionUsage>;

@Schema({ timestamps: true })
export class PromotionUsage {
  @Prop({ type: Types.ObjectId, ref: 'Promotion', required: true, index: true })
  promotion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  booking_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user_id: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Pet', default: null, index: true })
  pet_id: Types.ObjectId | null;

  @Prop({ enum: PromotionLimitType, required: true })
  limit_type: PromotionLimitType;

  @Prop({ enum: PromotionUsagePeriod, required: true })
  usage_period: PromotionUsagePeriod;

  @Prop({ type: Date, required: true, index: true })
  booking_date: Date;

  @Prop({ type: String, default: null, index: true })
  period_key: string | null;

  @Prop({ required: true })
  used_at: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const PromotionUsageSchema =
  SchemaFactory.createForClass(PromotionUsage);

PromotionUsageSchema.index({
  promotion_id: 1,
  user_id: 1,
  period_key: 1,
  isDeleted: 1,
});
PromotionUsageSchema.index({
  promotion_id: 1,
  pet_id: 1,
  period_key: 1,
  isDeleted: 1,
});
