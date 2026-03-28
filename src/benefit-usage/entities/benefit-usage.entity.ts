import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BenefitType,
  BenefitScope,
  BenefitPeriod,
} from 'src/membership/entities/membership.entity';

export type BenefitUsageDocument = HydratedDocument<BenefitUsage>;

@Schema({ timestamps: true })
export class BenefitUsage {
  @Prop({
    type: Types.ObjectId,
    ref: 'PetMembership',
    required: true,
    index: true,
  })
  pet_membership_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  benefit_id: Types.ObjectId; // References the _id in benefits_snapshot

  @Prop({ required: true })
  used_at: Date;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  booking_id: Types.ObjectId;

  @Prop({ enum: Object.values(BenefitScope), required: true })
  scope: BenefitScope;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  target_id: Types.ObjectId; // Service or addon ID

  @Prop({ required: true, min: 0 })
  amount_used: number; // Amount of benefit consumed

  /**
   * The scheduled booking date — used to determine which period slot this
   * usage belongs to (e.g. week of 2026-W13 or month of 2026-03).
   */
  @Prop({ required: true, index: true })
  booking_date: Date;

  /**
   * Period slot key derived from booking_date + benefit period:
   * – weekly   → "YYYY-WNN"  (ISO week, Monday-based)
   * – monthly  → "YYYY-MM"
   * – unlimited → null
   */
  @Prop({ type: String, default: null, index: true })
  period_key: string | null;

  /** Copy of the benefit's period type for fast filtering queries. */
  @Prop({ enum: Object.values(BenefitPeriod), required: true })
  benefit_period: BenefitPeriod;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const BenefitUsageSchema = SchemaFactory.createForClass(BenefitUsage);
