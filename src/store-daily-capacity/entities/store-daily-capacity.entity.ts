import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoreDailyCapacityDocument = HydratedDocument<StoreDailyCapacity>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.store_id;
      delete ret.created_by;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class StoreDailyCapacity {
  @Prop({
    type: Types.ObjectId,
    ref: 'Store',
    required: true,
  })
  store_id: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  total_capacity_minutes: number;

  @Prop()
  notes?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  created_by?: Types.ObjectId;
}

export const StoreDailyCapacitySchema =
  SchemaFactory.createForClass(StoreDailyCapacity);

// Virtual for store
StoreDailyCapacitySchema.virtual('store', {
  ref: 'Store',
  localField: 'store_id',
  foreignField: '_id',
  justOne: true,
});

// Virtual for creator
StoreDailyCapacitySchema.virtual('creator', {
  ref: 'User',
  localField: 'created_by',
  foreignField: '_id',
  justOne: true,
});
