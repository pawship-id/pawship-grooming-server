import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BookingStatus,
  SessionStatus,
  ServiceType,
  GroomingType,
  MediaType,
} from '../dto/booking.dto';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ _id: false })
export class PetSnapshot {
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

@Schema({ _id: false })
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

@Schema({ _id: false })
export class AssignedGroomer {
  @Prop({ required: true })
  task: string; // contoh: 'bathing' | 'styling'

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  groomer_id: Types.ObjectId;
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

      const petSizeId = ret.pet?.size?._id?.toString();
      const petTypeId = ret.pet?.pet_type?._id?.toString();
      const petHairId = ret.pet?.hair?._id?.toString();

      const findBestPrice = (prices: any[]): number => {
        if (!prices?.length) return 0;
        let best: any = null;
        let bestScore = -1;
        for (const p of prices) {
          let score = 0;
          if (petTypeId && p.pet_type_id?.toString() === petTypeId) score++;
          if (petSizeId && p.size_id?.toString() === petSizeId) score++;
          if (petHairId && p.hair_id?.toString() === petHairId) score++;
          if (score > bestScore) {
            bestScore = score;
            best = p;
          }
        }
        return best?.price ?? 0;
      };

      // transform price service - jika ada
      if (ret.service) {
        if (ret.service.price_type !== 'single') {
          ret.service.price = findBestPrice(ret.service.prices);
        }
        delete ret.service.prices;
        delete ret.service.price_type;
      }

      // transform price add on - jika ada
      if (ret.service_addons && ret.service_addons.length) {
        ret.service_addons = ret.service_addons.map((addon: any) => {
          if (addon.price_type !== 'single') {
            addon.price = findBestPrice(addon.prices);
          }
          delete addon.prices;
          delete addon.price_type;
          return addon;
        });
      }

      if (ret.assigned_groomers?.length) {
        ret.assigned_groomers = ret.assigned_groomers.map((el: any) => {
          return {
            task: el.task,
            groomer_detail: {
              _id: el.groomer_id._id,
              username: el.groomer_id.username,
              email: el.groomer_id.email,
              phone_number: el.groomer_id.phone_number,
            },
          };
        });
      }

      if (ret.service_snapshot) {
        delete ret.service_snapshot.service_type.id;

        if (ret.service_snapshot.addons.length) {
          ret.service_snapshot.addons.forEach((el: any) => {
            delete el.id;
          });
        }
      }

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Booking {
  /* ===== Service Type ===== */
  @Prop({
    enum: ServiceType,
    default: ServiceType.GROOMING,
  })
  service_type: ServiceType;

  /* ===== Owner ===== */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer_id: Types.ObjectId;

  /* ===== Pet ===== */
  @Prop({ type: PetSnapshot, required: true })
  pet_snapshot: PetSnapshot;

  @Prop({ type: ServiceSnapshot, default: null })
  service_snapshot?: ServiceSnapshot;

  @Prop({ type: Types.ObjectId, ref: 'Pet', required: true })
  pet_id: Types.ObjectId;

  /* ===== Schedule ===== */
  @Prop({ type: Types.ObjectId, ref: 'Store' })
  store_id?: Types.ObjectId;

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
  total_price: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Promo' }],
    default: [],
  })
  discount_ids: Types.ObjectId[];

  /* ===== Groomer ===== */
  @Prop({
    type: [AssignedGroomer],
    default: [],
  })
  assigned_groomers: AssignedGroomer[];

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
