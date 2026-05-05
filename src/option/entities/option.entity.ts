import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OptionDocument = HydratedDocument<Option>;

@Schema({ _id: false })
export class PetWeightRule {
  @Prop({ required: true })
  minWeight: number;

  @Prop({ required: true })
  maxWeight: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Option',
    required: true,
  })
  petTypeId: Types.ObjectId;
}

export const PetWeightRuleSchema = SchemaFactory.createForClass(PetWeightRule);

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

  @Prop({ type: [PetWeightRuleSchema], default: [] })
  pet_weight_rules: PetWeightRule[];
}

export const OptionSchema = SchemaFactory.createForClass(Option);
