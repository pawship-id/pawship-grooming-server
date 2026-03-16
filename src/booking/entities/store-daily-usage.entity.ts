import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoreDailyUsageDocument = HydratedDocument<StoreDailyUsage>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.store_id;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class StoreDailyUsage {
  @Prop({
    type: Types.ObjectId,
    ref: 'Store',
    required: true,
  })
  store_id: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, default: 0 })
  used_minutes: number;
}

export const StoreDailyUsageSchema =
  SchemaFactory.createForClass(StoreDailyUsage);

// Create unique compound index for store_id + date
StoreDailyUsageSchema.index({ store_id: 1, date: 1 }, { unique: true });

// Virtual for store
StoreDailyUsageSchema.virtual('store', {
  ref: 'Store',
  localField: 'store_id',
  foreignField: '_id',
  justOne: true,
});
