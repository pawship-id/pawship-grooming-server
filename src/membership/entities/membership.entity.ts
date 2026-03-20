import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

export enum BenefitType {
  DISCOUNT = 'discount',
  QUOTA = 'quota',
}

export enum BenefitScope {
  SERVICE = 'service',
  ADDON = 'addon',
  PICKUP = 'pickup',
}

export enum BenefitPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  UNLIMITED = 'unlimited', // No reset, berlaku sepanjang membership
}

@Schema({ _id: false })
export class MembershipBenefit {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ enum: BenefitScope, required: true })
  applies_to: BenefitScope;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service_id?: Types.ObjectId;

  @Prop()
  label?: string; // Required when service_id is not set

  @Prop({ enum: BenefitType, required: true })
  type: BenefitType;

  @Prop({ enum: BenefitPeriod, default: BenefitPeriod.UNLIMITED })
  period: BenefitPeriod;

  @Prop()
  limit?: number; // null/omitted = unlimited

  @Prop()
  value?: number; // Required for discount type (percentage)
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;

      delete ret.pet_type_ids;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Membership {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 1 })
  duration_months: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop()
  note?: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Option' }],
    default: [],
  })
  pet_type_ids: Types.ObjectId[];

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
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
      },
    ],
    default: [],
  })
  benefits: MembershipBenefit[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.virtual('pet_types', {
  ref: 'Option',
  localField: 'pet_type_ids',
  foreignField: '_id',
});
