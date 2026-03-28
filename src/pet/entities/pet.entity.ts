import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PetDocument = HydratedDocument<Pet>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      delete ret.pet_type_id;
      delete ret.hair_category_id;
      delete ret.size_category_id;
      delete ret.breed_category_id;
      delete ret.member_category_id;
      delete ret.customer_id;

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Pet {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  internal_note: string;

  @Prop({
    type: {
      secure_url: { type: String },
      public_id: { type: String },
    },
    _id: false,
  })
  profile_image?: {
    secure_url?: string;
    public_id?: string;
  };

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  pet_type_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
  })
  hair_category_id: Types.ObjectId;

  @Prop()
  birthday: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  size_category_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  breed_category_id: Types.ObjectId;

  @Prop()
  weight: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
  })
  member_category_id: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  last_grooming_at: Date;

  @Prop({ type: Date })
  last_visit_at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer_id: Types.ObjectId;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const PetSchema = SchemaFactory.createForClass(Pet);

PetSchema.virtual('pet_type', {
  ref: 'Option',
  localField: 'pet_type_id',
  foreignField: '_id',
  justOne: true,
});

PetSchema.virtual('hair', {
  ref: 'Option',
  localField: 'hair_category_id',
  foreignField: '_id',
  justOne: true,
});

PetSchema.virtual('size', {
  ref: 'Option',
  localField: 'size_category_id',
  foreignField: '_id',
  justOne: true,
});

PetSchema.virtual('breed', {
  ref: 'Option',
  localField: 'breed_category_id',
  foreignField: '_id',
  justOne: true,
});

PetSchema.virtual('member_category', {
  ref: 'Option',
  localField: 'member_category_id',
  foreignField: '_id',
  justOne: true,
});

PetSchema.virtual('owner', {
  ref: 'User',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true,
});
