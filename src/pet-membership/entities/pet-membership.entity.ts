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

  @Prop({ enum: BenefitScope, required: true })
  applies_to: BenefitScope;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service_id?: Types.ObjectId;

  @Prop()
  label?: string;

  @Prop({ enum: BenefitType, required: true })
  type: BenefitType;

  @Prop({ enum: BenefitPeriod, default: BenefitPeriod.UNLIMITED })
  period: BenefitPeriod;

  @Prop()
  limit?: number; // null/omitted = unlimited

  @Prop()
  value?: number;

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
        applies_to: { type: String, enum: Object.values(BenefitScope) },
        service_id: { type: Types.ObjectId, ref: 'Service' },
        label: { type: String },
        type: { type: String, enum: Object.values(BenefitType) },
        period: {
          type: String,
          enum: Object.values(BenefitPeriod),
          default: BenefitPeriod.UNLIMITED,
        },
        limit: { type: Number },
        value: { type: Number },
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
  justOne: true,
});
