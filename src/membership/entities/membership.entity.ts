import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.service_include_ids;
      delete ret.pet_type_ids;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Membership {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Option' }],
    default: [],
  })
  pet_type_ids: Types.ObjectId[];

  @Prop({ required: true })
  duration_months: number;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  max_usage: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Service' }],
    default: [],
  })
  service_include_ids: Types.ObjectId[];

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.virtual('pet_types', {
  ref: 'Option',
  localField: 'pet_type_ids',
  foreignField: '_id',
});

MembershipSchema.virtual('service_includes', {
  ref: 'Service',
  localField: 'service_include_ids',
  foreignField: '_id',
});
