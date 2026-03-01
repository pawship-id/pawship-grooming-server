import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ZoneDocument = HydratedDocument<Zone>;

@Schema({ timestamps: true })
export class Zone {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  store_id: Types.ObjectId;

  @Prop({ required: true })
  area_name: string;

  @Prop({ required: true })
  min_radius_km: number;

  @Prop({ required: true })
  max_radius_km: number;

  @Prop({ required: true })
  travel_time_minutes: number;

  @Prop({ required: true })
  travel_fee: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);

ZoneSchema.virtual('store', {
  ref: 'Store',
  localField: 'store_id',
  foreignField: '_id',
  justOne: true,
});

ZoneSchema.set('toJSON', { virtuals: true });
ZoneSchema.set('toObject', { virtuals: true });
