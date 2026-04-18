import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AppliesTo,
  DiscountType,
  PromotionLimitType,
  PromotionUsagePeriod,
} from '../dto/create-promotion.dto';

export type PromotionDocument = HydratedDocument<Promotion>;

// ─── Root schema ─────────────────────────────────────────────────────────────

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      delete ret.id;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      delete ret.__v;

      // Promote populated service_id → service
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (
        ret.service_id &&
        typeof ret.service_id === 'object' &&
        ret.service_id._id
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ret.service = ret.service_id;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ret.service_id = ret.service_id._id;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Promotion {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description!: string;

  @Prop({ required: true, enum: AppliesTo })
  applies_to!: AppliesTo;

  @Prop({ type: Types.ObjectId, ref: 'Service', default: null })
  service_id!: Types.ObjectId | null;

  @Prop({ required: true, enum: DiscountType })
  discount_type!: DiscountType;

  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ required: true })
  start_date!: Date;

  @Prop({ type: Date, default: null })
  end_date!: Date | null;

  @Prop({ default: false })
  is_available_to_membership!: boolean;

  @Prop({ default: false })
  is_stackable!: boolean;

  @Prop({ default: true })
  is_active!: boolean;

  @Prop({ enum: PromotionLimitType, default: PromotionLimitType.NONE })
  limit_type!: PromotionLimitType;

  @Prop({ type: Number, default: null, min: 1 })
  max_usage!: number | null;

  @Prop({ enum: PromotionUsagePeriod, default: PromotionUsagePeriod.LIFETIME })
  usage_period!: PromotionUsagePeriod;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);

PromotionSchema.index({ code: 1 }, { unique: true });
PromotionSchema.index({
  is_active: 1,
  isDeleted: 1,
  start_date: 1,
  end_date: 1,
});
PromotionSchema.index({ limit_type: 1, usage_period: 1 });
