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
  ONCE = 'once', // Hanya sekali selama masa membership, tidak pernah reset
}

export enum BenefitDiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum BenefitVariantMode {
  ALL = 'all',
  PER_VARIANT = 'per_variant',
}

@Schema({ _id: false })
export class MembershipBenefitVariantDiscount {
  @Prop({ type: Types.ObjectId })
  pet_type_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  size_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  hair_id?: Types.ObjectId;

  @Prop({ required: true })
  value: number;
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
  value?: number; // Required for discount type (percentage or global fixed)

  // New fields — absence means legacy behavior (percentage, all variants)
  @Prop({ enum: BenefitDiscountType })
  discount_type?: BenefitDiscountType;

  @Prop({ enum: BenefitVariantMode })
  variant_mode?: BenefitVariantMode;

  @Prop({
    type: [
      {
        pet_type_id: { type: Types.ObjectId },
        size_id: { type: Types.ObjectId },
        hair_id: { type: Types.ObjectId },
        value: { type: Number, required: true },
      },
    ],
    default: undefined,
  })
  variant_discounts?: MembershipBenefitVariantDiscount[];
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
  @Prop({ unique: true, sparse: true })
  code?: string;

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
        discount_type: { type: String, enum: Object.values(BenefitDiscountType) },
        variant_mode: { type: String, enum: Object.values(BenefitVariantMode) },
        variant_discounts: [
          {
            pet_type_id: { type: Types.ObjectId },
            size_id: { type: Types.ObjectId },
            hair_id: { type: Types.ObjectId },
            value: { type: Number, required: true },
          },
        ],
      },
    ],
    default: [],
  })
  benefits: MembershipBenefit[];

  // ── Public display fields ───────────────────────────────────────────────
  @Prop({ default: false })
  show_on_website: boolean;

  @Prop({ default: 0 })
  display_order: number;

  @Prop()
  badge_label?: string;

  @Prop({ enum: ['best', 'premium'] })
  badge_variant?: string;

  @Prop({ default: false })
  featured: boolean;

  @Prop()
  original_price?: number;

  @Prop({ type: [String], default: [] })
  display_benefits: string[];

  // ── Soft delete ─────────────────────────────────────────────────────────
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
