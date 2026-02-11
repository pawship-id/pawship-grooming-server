import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OptionDocument = HydratedDocument<Option>;

@Schema({ timestamps: true })
export class Option {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category_options: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const OptionSchema = SchemaFactory.createForClass(Option);
