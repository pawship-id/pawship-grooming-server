import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BenefitType,
  BenefitScope,
  BenefitPeriod,
} from 'src/membership/entities/membership.entity';

export type PetMembershipDocument = HydratedDocument<PetMembership>;

@Schema({ _id: false })
export class PetMembershipBenefit {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop({ enum: BenefitType, required: true })
  type: BenefitType;

  @Prop({ enum: BenefitScope, required: true })
  applies_to: BenefitScope;

  @Prop({ enum: BenefitPeriod, default: BenefitPeriod.UNLIMITED })
  period: BenefitPeriod;

  @Prop()
  value?: number;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service_id?: Types.ObjectId;

  @Prop({ default: -1 })
  limit: number;

  @Prop({ default: 0 })
  used: number; // Track usage untuk periode saat ini

  @Prop({ type: Date, default: null })
  period_reset_date: Date | null; // Kapan counter reset terakhir
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;

      delete ret.pet_id;
      delete ret.membership_plan_id;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class PetMembership {
  @Prop({ type: Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Membership', required: true })
  membership_plan_id: Types.ObjectId;

  @Prop({ required: true, index: true })
  start_date: Date;

  @Prop({ required: true, index: true })
  end_date: Date;

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId },
        type: { type: String, enum: Object.values(BenefitType) },
        applies_to: { type: String, enum: Object.values(BenefitScope) },
        period: {
          type: String,
          enum: Object.values(BenefitPeriod),
          default: BenefitPeriod.UNLIMITED,
        },
        value: { type: Number },
        service_id: { type: Types.ObjectId, ref: 'Service' },
        limit: { type: Number, default: -1 },
        used: { type: Number, default: 0 },
        period_reset_date: { type: Date, default: null },
      },
    ],
    default: [],
  })
  benefits_snapshot: PetMembershipBenefit[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const PetMembershipSchema = SchemaFactory.createForClass(PetMembership);

// Virtual for is_active (check date range)
PetMembershipSchema.virtual('is_active').get(function () {
  if (this.isDeleted) return false;
  const now = new Date();
  return now >= this.start_date && now <= this.end_date;
});

PetMembershipSchema.virtual('pet', {
  ref: 'Pet',
  localField: 'pet_id',
  foreignField: '_id',
  justOne: true,
});

PetMembershipSchema.virtual('membership', {
  ref: 'Membership',
  localField: 'membership_plan_id',
  foreignField: '_id',
});
