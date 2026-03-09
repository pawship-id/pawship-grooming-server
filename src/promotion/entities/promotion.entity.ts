import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BenefitType,
  ClaimType,
  DiscountType,
  PromoType,
} from '../dto/create-promotion.dto';

export type PromotionDocument = HydratedDocument<Promotion>;

// ─── Embedded sub-schemas ─────────────────────────────────────────────────────

@Schema({ _id: false })
export class PromotionBenefit {
  @Prop({ required: true, enum: BenefitType })
  type: BenefitType;

  @Prop({ type: String, enum: DiscountType, default: null })
  discount_type: DiscountType | null;

  @Prop({ type: Number, default: null })
  value: number | null;

  @Prop({ type: Types.ObjectId, ref: 'Service', default: null })
  service_id: Types.ObjectId | null;
}
export const PromotionBenefitSchema =
  SchemaFactory.createForClass(PromotionBenefit);

@Schema({ _id: false })
export class PromotionEligibility {
  @Prop({ required: true })
  is_only_for_membership: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Membership' }], default: [] })
  membership_ids: Types.ObjectId[];

  @Prop({ default: false })
  first_time_user: boolean;
}
export const PromotionEligibilitySchema =
  SchemaFactory.createForClass(PromotionEligibility);

@Schema({ _id: false })
export class PromotionValidity {
  @Prop({ required: true })
  start_at: Date;

  @Prop({ type: Date, default: null })
  end_at: Date | null;
}
export const PromotionValiditySchema =
  SchemaFactory.createForClass(PromotionValidity);

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

      // Transform populated benefit.service_id
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (ret.benefit && ret.benefit.service_id) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const svc = ret.benefit.service_id;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof svc === 'object' && svc !== null && svc._id) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          ret.benefit.service = svc;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          ret.benefit.service_id = svc._id;
        }
      }

      // Transform populated eligibility.membership_ids
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (ret.eligibility && Array.isArray(ret.eligibility.membership_ids)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const ids = ret.eligibility.membership_ids;
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ids.length > 0 &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          typeof ids[0] === 'object' &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ids[0] !== null &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ids[0]._id
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          ret.eligibility.memberships = ids;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
          ret.eligibility.membership_ids = ids.map((m: any) => m._id);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Promotion {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: PromoType })
  promo_type: PromoType;

  @Prop({ required: true, enum: ClaimType })
  claim_type: ClaimType;

  @Prop({ type: PromotionBenefitSchema, required: true })
  benefit: PromotionBenefit;

  @Prop({ type: PromotionEligibilitySchema, default: {} })
  eligibility: PromotionEligibility;

  @Prop({ type: PromotionValiditySchema, required: true })
  validity: PromotionValidity;

  @Prop({ default: false })
  stackable: boolean;

  @Prop({ default: 0 })
  priority: number;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
