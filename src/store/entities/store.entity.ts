import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreDocument = HydratedDocument<Store>;

@Schema({
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
    },
  },
})
export class Store {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({
    type: {
      address: { type: String },
      city: { type: String },
      province: { type: String },
      postal_code: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    _id: false,
  })
  location?: {
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };

  @Prop({
    type: {
      phone_number: { type: String },
      whatsapp: { type: String },
      email: { type: String },
    },
    _id: false,
  })
  contact?: {
    phone_number?: string;
    whatsapp?: string;
    email?: string;
  };

  @Prop({
    type: {
      opening_time: { type: String },
      closing_time: { type: String },
      operational_days: { type: [String] },
      timezone: { type: String, default: 'Asia/Jakarta' },
    },
    _id: false,
  })
  operational?: {
    opening_time?: string;
    closing_time?: string;
    operational_days?: string[];
    timezone?: string;
  };

  @Prop({
    type: {
      default_daily_capacity_minutes: { type: Number, default: 960 },
      overbooking_limit_minutes: { type: Number, default: 120 },
    },
    _id: false,
    default: () => ({
      default_daily_capacity_minutes: 960,
      overbooking_limit_minutes: 120,
    }),
  })
  capacity: {
    default_daily_capacity_minutes: number;
    overbooking_limit_minutes: number;
  };

  @Prop({ type: [String], default: [] })
  sessions: string[];

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);

StoreSchema.virtual('serviceTypes', {
  ref: 'ServiceType',
  localField: '_id',
  foreignField: 'store_ids',
});
