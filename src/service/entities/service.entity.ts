import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ _id: false })
export class ServicePrice {
  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  size_id: Types.ObjectId;

  @Prop({ required: true })
  price: number;
}

export const ServicePriceSchema = SchemaFactory.createForClass(ServicePrice);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.size_category_ids;
      delete ret.service_type_id;
      delete ret.pet_type_ids;
      delete ret.available_store_ids;
      delete ret.addon_ids;

      if (ret.prices?.length) {
        ret.prices = ret.prices.map((p) => ({
          size_id:
            p.size_id && typeof p.size_id === 'object'
              ? p.size_id._id
              : p.size_id,
          name:
            p.size_id && typeof p.size_id === 'object'
              ? p.size_id.name
              : undefined,
          price: p.price,
        }));
      }

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Service {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  image_url: string;

  @Prop()
  public_id: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'ServiceType',
    required: true,
  })
  service_type_id: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Option' }],
    default: [],
  })
  pet_type_ids: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Option' }],
    required: true,
    default: [],
  })
  size_category_ids: Types.ObjectId[];

  @Prop({
    type: [ServicePriceSchema],
    required: true,
    default: [],
  })
  prices: ServicePrice[];

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true, default: true })
  available_for_unlimited: boolean;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Store' }],
    default: [],
  })
  available_store_ids: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Service' }],
    default: [],
  })
  addon_ids: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  include: string[];

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.virtual('service_type', {
  ref: 'ServiceType',
  localField: 'service_type_id',
  foreignField: '_id',
  justOne: true,
});

ServiceSchema.virtual('size_categories', {
  ref: 'Option',
  localField: 'size_category_ids',
  foreignField: '_id',
});

ServiceSchema.virtual('pet_types', {
  ref: 'Option',
  localField: 'pet_type_ids',
  foreignField: '_id',
});

ServiceSchema.virtual('avaiable_store', {
  ref: 'Store',
  localField: 'available_store_ids',
  foreignField: '_id',
});

ServiceSchema.virtual('addons', {
  ref: 'Service',
  localField: 'addon_ids',
  foreignField: '_id',
});
