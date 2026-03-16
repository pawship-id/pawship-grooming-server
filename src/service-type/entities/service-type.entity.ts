import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

export type ServiceTypeDocument = HydratedDocument<ServiceType>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.store_ids;
      delete ret.id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class ServiceType {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop()
  image_url: string;

  @Prop()
  public_id: string;

  @Prop({ default: false })
  is_active: boolean;

  @Prop({ default: false })
  show_in_homepage: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Store' }], default: [] })
  store_ids: Types.ObjectId[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ServiceTypeSchema = SchemaFactory.createForClass(ServiceType);

ServiceTypeSchema.virtual('stores', {
  ref: 'Store',
  localField: 'store_ids',
  foreignField: '_id',
});
