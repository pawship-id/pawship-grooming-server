import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.service_type_id;
      delete ret.size_category_id;
      delete ret.pet_type_ids;
      delete ret.available_store_ids;

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

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  service_type_id: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Option' }],
    default: [],
  })
  pet_type_ids: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  size_category_id: Types.ObjectId;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true, default: true })
  available_for_unlimited: boolean;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Store' }],
    default: [],
  })
  available_store_ids: Types.ObjectId[];

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.virtual('service_type', {
  ref: 'Option',
  localField: 'service_type_id',
  foreignField: '_id',
  justOne: true,
});

ServiceSchema.virtual('size_category', {
  ref: 'Option',
  localField: 'size_category_id',
  foreignField: '_id',
  justOne: true,
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
