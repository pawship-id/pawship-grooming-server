import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BookingStatus,
  SessionStatus,
  GroomingType,
  MediaType,
} from '../dto/booking.dto';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ _id: false })
export class ZoneSnapshot {
  @Prop()
  area_name?: string;

  @Prop({ type: Number })
  min_radius_km?: number;

  @Prop({ type: Number })
  max_radius_km?: number;

  @Prop({ type: Number })
  travel_time_minutes?: number;

  @Prop({ type: Number })
  travel_fee?: number;
}

@Schema({ _id: false })
export class AppliedBenefit {
  @Prop({ type: Types.ObjectId, required: true })
  benefit_id: Types.ObjectId;

  @Prop({ required: true })
  benefit_type: string; // 'discount', 'free_service', 'quota'

  @Prop({ required: true })
  benefit_period: string; // 'weekly', 'monthly', 'unlimited'

  @Prop()
  benefit_value?: number; // percentage, amount, or quantity

  @Prop({ required: true })
  amount_deducted: number; // amount berkurang dari total harga

  @Prop({ required: true })
  applied_at: Date;
}

@Schema({
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      if (ret.member_type) {
        delete ret.member_type.id;
      }

      if (ret.pet_type) {
        delete ret.pet_type.id;
      }

      if (ret.size) {
        delete ret.size.id;
      }

      if (ret.hair) {
        delete ret.hair.id;
      }

      if (ret.breed) {
        delete ret.breed.id;
      }
    },
  },
  toObject: { virtuals: true },
})
export class PetSnapshot {
  @Prop({ type: Types.ObjectId })
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    default: null,
  })
  member_type?: { _id: Types.ObjectId; name: string } | null;

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    default: null,
  })
  pet_type?: { _id: Types.ObjectId; name: string };

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    default: null,
  })
  size?: { _id: Types.ObjectId; name: string };

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    default: null,
  })
  hair?: { _id: Types.ObjectId; name: string };

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    default: null,
  })
  breed?: { _id: Types.ObjectId; name: string };
}

@Schema({
  _id: false,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.service_type.id;
      delete ret.id;

      if (ret.addons.length) {
        ret.addons.forEach((el: any) => {
          delete el.id;
        });
      }
    },
  },
  toObject: { virtuals: true },
})
export class ServiceSnapshot {
  @Prop({ type: Types.ObjectId })
  _id?: Types.ObjectId;

  @Prop()
  code?: string;

  @Prop()
  name?: string;

  @Prop()
  description?: string;

  @Prop({
    type: { _id: { type: Types.ObjectId }, title: { type: String } },
    default: null,
  })
  service_type?: { _id: Types.ObjectId; title: string };

  @Prop({ default: 0 })
  price?: number;

  @Prop({ default: 0 })
  duration?: number;

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId },
        code: { type: String },
        name: { type: String },
        price: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
      },
    ],
    default: undefined,
  })
  addons?: {
    _id: Types.ObjectId;
    code: string;
    name: string;
    price: number;
    duration: number;
  }[];
}

@Schema({ _id: false })
export class SessionMedia {
  @Prop({
    enum: MediaType,
    required: true,
  })
  type: MediaType;

  @Prop({ required: true })
  secure_url: string;

  @Prop({ required: true })
  public_id: string;

  @Prop()
  note?: string;

  @Prop({
    type: {
      user_id: { type: String, required: true },
      name_snapshot: { type: String, required: true },
    },
    required: true,
    _id: false,
  })
  created_by: {
    user_id: string;
    name_snapshot: string;
  };

  @Prop({ default: Date.now })
  uploaded_at: Date;
}

// Session - represents one grooming activity (bathing, styling, etc.)
@Schema()
export class GroomingSession {
  @Prop({ type: String, required: true })
  type: string; // Dynamic type: "bathing", "styling", "nail_trimming", etc.

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  groomer_id: Types.ObjectId;

  @Prop({
    enum: SessionStatus,
    default: SessionStatus.NOT_STARTED,
  })
  status: SessionStatus;

  @Prop({ default: null })
  started_at?: Date;

  @Prop({ default: null })
  finished_at?: Date;

  @Prop()
  notes?: string;

  @Prop()
  internal_note?: string;

  @Prop({
    type: [SessionMedia],
    default: [],
  })
  media?: SessionMedia[];

  @Prop({ default: 0 })
  order: number; // For session sequencing
}

@Schema({ _id: false })
export class BookingStatusLog {
  @Prop({ enum: BookingStatus, required: true })
  status: BookingStatus;

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  note?: string;
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.customer_id;
      delete ret.pet_id;
      delete ret.store_id;
      delete ret.service_id;
      delete ret.service_addon_ids;

      if (ret.sessions?.length) {
        ret.sessions = ret.sessions.map((session: any) => {
          const s = { ...session };
          if (s.groomer_id && typeof s.groomer_id === 'object') {
            s.groomer_detail = {
              _id: s.groomer_id._id,
              username: s.groomer_id.username,
              email: s.groomer_id.email,
              phone_number: s.groomer_id.phone_number,
            };
            delete s.groomer_id;
          }
          return s;
        });
      }

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Booking {
  /* ===== Service Type ===== */
  @Prop({ type: Types.ObjectId, ref: 'ServiceType', required: true })
  service_type_id: Types.ObjectId;

  /* ===== Owner ===== */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer_id: Types.ObjectId;

  /* ===== Pet ===== */
  @Prop({ type: PetSnapshot, required: true })
  pet_snapshot: PetSnapshot;

  @Prop({ type: ServiceSnapshot, required: true })
  service_snapshot: ServiceSnapshot;

  @Prop({ type: Types.ObjectId, ref: 'Pet', required: true })
  pet_id: Types.ObjectId;

  /* ===== Schedule ===== */
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  store_id: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  time_range: string;

  @Prop({ enum: GroomingType, required: true })
  type: GroomingType;

  /* ===== Workflow ===== */
  @Prop({
    enum: BookingStatus,
    default: BookingStatus.REQUESTED,
  })
  booking_status: BookingStatus;

  @Prop({ type: [BookingStatusLog], default: [] })
  status_logs: BookingStatusLog[];

  /* ===== Service ===== */
  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service_id: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'ServiceAddon' }],
    default: [],
  })
  service_addon_ids: Types.ObjectId[];

  /* ===== Pricing ===== */
  @Prop({ default: 0 })
  travel_fee: number;

  @Prop({ default: true })
  sub_total_service: number;

  @Prop({ required: true })
  original_total_price: number; // harga sebelum benefit

  @Prop({ required: true })
  final_total_price: number; // harga setelah benefit diterapkan

  @Prop({ default: null })
  total_price: number; // deprecated, gunakan final_total_price

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Promo' }],
    default: [],
  })
  discount_ids: Types.ObjectId[];

  /* ===== Misc ===== */
  @Prop()
  referal_code?: string;

  @Prop()
  note?: string;

  @Prop()
  payment_method?: string;

  /* ===== Sessions - Array of grooming/hotel sessions ===== */
  @Prop({
    type: [GroomingSession],
    default: [],
  })
  sessions: GroomingSession[];

  /* ===== Media - Per-booking media uploads (photos/videos) ===== */
  @Prop({
    type: [SessionMedia],
    default: [],
  })
  media: SessionMedia[];

  /* ===== Pick-up Service ===== */
  @Prop({ default: false })
  pick_up: boolean;

  @Prop({ type: ZoneSnapshot })
  pick_up_zone?: ZoneSnapshot;

  /* ===== Membership Benefits ===== */
  @Prop({ type: [Types.ObjectId], default: [] })
  selected_benefit_ids: Types.ObjectId[];

  @Prop({ type: [AppliedBenefit], default: [] })
  applied_benefits: AppliedBenefit[];

  /* ===== Soft Delete ===== */
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.virtual('customer', {
  ref: 'User',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true,
});

BookingSchema.virtual('pet', {
  ref: 'Pet',
  localField: 'pet_id',
  foreignField: '_id',
  justOne: true,
});

BookingSchema.virtual('store', {
  ref: 'Store',
  localField: 'store_id',
  foreignField: '_id',
  justOne: true,
});

BookingSchema.virtual('service', {
  ref: 'Service',
  localField: 'service_id',
  foreignField: '_id',
  justOne: true,
});

BookingSchema.virtual('service_addons', {
  ref: 'Service',
  localField: 'service_addon_ids',
  foreignField: '_id',
});
