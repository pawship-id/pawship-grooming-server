import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

export enum BenefitType {
  DISCOUNT = 'discount',
  FREE_SERVICE = 'free_service',
  QUOTA = 'quota',
}

export enum BenefitScope {
  SERVICE = 'service',
  ADDON = 'addon',
  ORDER = 'order',
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

  @Prop({ enum: BenefitType, required: true })
  type: BenefitType;

  @Prop({ enum: BenefitScope, required: true })
  applies_to: BenefitScope;

  @Prop({ enum: BenefitPeriod, default: BenefitPeriod.UNLIMITED })
  period: BenefitPeriod;

  @Prop()
  value?: number; // percentage, amount, or quantity

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service_id?: Types.ObjectId; // Required for free_service type

  @Prop({ default: -1 })
  limit: number; // -1 = unlimited
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
        type: { type: String, enum: Object.values(BenefitType) },
        applies_to: { type: String, enum: Object.values(BenefitScope) },
        value: { type: Number },
        service_id: { type: Types.ObjectId, ref: 'Service' },
        limit: { type: Number, default: -1 },
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
