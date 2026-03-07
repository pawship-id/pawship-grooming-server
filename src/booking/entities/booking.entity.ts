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

  @Prop()
  member_type?: string;
}

@Schema({ _id: false })
export class ServiceSnapshot {
  @Prop()
  code?: string;

  @Prop()
  name?: string;

  @Prop()
  description?: string;

  @Prop({
    type: { _id: { type: Types.ObjectId }, title: { type: String } },
    _id: false,
    default: null,
  })
  service_type?: { _id: Types.ObjectId; title: string };

  @Prop({ default: 0 })
  price?: number;

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    _id: false,
    default: null,
  })
  pet_type?: { _id: Types.ObjectId; name: string };

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    _id: false,
    default: null,
  })
  size?: { _id: Types.ObjectId; name: string };

  @Prop({
    type: { _id: { type: Types.ObjectId }, name: { type: String } },
    _id: false,
    default: null,
  })
  hair?: { _id: Types.ObjectId; name: string };

  @Prop({ default: 0 })
  duration?: number;
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

      if (ret.pet?.size?._id) {
        const petSizeId = ret.pet.size._id.toString();

        // transform price service - jika ada
        if (ret.service) {
          let find_service_price = ret.service.prices.find(
            (el: any) => el.size_id.toString() === petSizeId,
          );

          ret.service.price = find_service_price.price;
          delete ret.service.prices;
        }

        // transform price add on - jika ada
        if (ret.service_addons && ret.service_addons.length) {
          ret.service_addons = ret.service_addons.map((addon: any) => {
            let find_service_price = addon.prices.find(
              (el: any) => el.size_id.toString() === petSizeId,
            );

            addon.price = find_service_price.price;
            delete addon.prices;
            return addon;
          });
        }
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
