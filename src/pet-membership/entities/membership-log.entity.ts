import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BenefitType,
  BenefitScope,
  BenefitPeriod,
} from 'src/membership/entities/membership.entity';

export type MembershipLogDocument = HydratedDocument<MembershipLog>;

export enum MembershipEventType {
  PURCHASED = 'purchased',
  RENEWED = 'renewed',
  CANCELLED = 'cancelled',
  UPDATED = 'updated',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.pet_id;
      delete ret.pet_membership_id;
      delete ret.membership_plan_id;
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class MembershipLog {
  @Prop({ type: Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'PetMembership',
    required: true,
    index: true,
  })
  pet_membership_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Membership', required: true })
  membership_plan_id: Types.ObjectId;

  @Prop({ enum: Object.values(MembershipEventType), required: true })
  event_type: MembershipEventType;

  @Prop({ required: true, default: () => new Date() })
  event_date: Date;

  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  @Prop()
  purchase_price?: number;

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId },
        applies_to: { type: String, enum: Object.values(BenefitScope) },
        service_id: { type: Types.ObjectId, ref: 'Service' },
        label: { type: String },
        type: { type: String, enum: Object.values(BenefitType) },
        period: { type: String, enum: Object.values(BenefitPeriod) },
        limit: { type: Number },
        value: { type: Number },
        used: { type: Number, default: 0 },
        period_reset_date: { type: Date, default: null },
      },
    ],
    default: [],
  })
  benefits_snapshot_before: any[];

  @Prop()
  note?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const MembershipLogSchema = SchemaFactory.createForClass(MembershipLog);

MembershipLogSchema.virtual('membership', {
  ref: 'Membership',
  localField: 'membership_plan_id',
  foreignField: '_id',
  justOne: true,
});

MembershipLogSchema.virtual('pet', {
  ref: 'Pet',
  localField: 'pet_id',
  foreignField: '_id',
  justOne: true,
});
