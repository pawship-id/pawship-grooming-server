import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BenefitType,
  BenefitScope,
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

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const BenefitUsageSchema = SchemaFactory.createForClass(BenefitUsage);
