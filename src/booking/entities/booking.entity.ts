import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BookingStatus,
  GroomingSessionStatus,
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
export class GroomingMedia {
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
}

@Schema({ _id: false })
export class GroomingSession {
  @Prop({
    enum: GroomingSessionStatus,
    default: GroomingSessionStatus.NOT_STARTED,
  })
  status: GroomingSessionStatus;

  @Prop({ default: null })
  arrived_at?: Date; // IN HOME

  @Prop({ default: null })
  started_at?: Date;

  @Prop({ default: null })
  finished_at?: Date;

  @Prop()
  notes?: string;

  @Prop()
  internal_note?: string;

  @Prop({
    type: [GroomingMedia],
    default: [],
  })
  media?: GroomingMedia[];
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
      delete ret.assigned_groomer_ids;

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

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Booking {
  /* ===== Owner ===== */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer_id: Types.ObjectId;

  /* ===== Pet ===== */
  @Prop({ type: PetSnapshot, required: true })
  pet_snapshot: PetSnapshot;

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
    type: [{ type: Types.ObjectId, ref: 'Groomer' }],
    default: [],
  })
  assigned_groomer_ids: Types.ObjectId[];

  /* ===== Misc ===== */
  @Prop()
  referal_code?: string;

  @Prop()
  note?: string;

  @Prop()
  payment_method?: string;

  /* ===== Grooming Execution ===== */
  @Prop({ type: GroomingSession })
  grooming_session?: GroomingSession;

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

BookingSchema.virtual('groomers', {
  ref: 'User',
  localField: 'assigned_groomer_ids',
  foreignField: '_id',
});
