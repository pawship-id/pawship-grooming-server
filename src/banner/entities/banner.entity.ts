import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BannerDocument = HydratedDocument<Banner>;

export enum CtaVerticalPosition {
  TOP = 'top',
  CENTER = 'center',
  BOTTOM = 'bottom',
}

export enum CtaHorizontalPosition {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export enum BannerPage {
  HOME = 'home',
  GROOMING = 'grooming',
  MEMBERSHIP = 'membership',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: any) => {
      delete ret.id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Banner {
  @Prop({
    type: {
      image_url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
    _id: false,
    required: true,
  })
  banner_desktop: { image_url: string; public_id: string };

  @Prop({
    type: {
      image_url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
    _id: false,
    required: false,
    default: null,
  })
  banner_mobile: { image_url: string; public_id: string } | null;

  @Prop({ default: false })
  add_text: boolean;

  @Prop()
  title: string;

  @Prop()
  subtitle: string;

  @Prop()
  text_align: string;

  @Prop()
  text_color: string;

  @Prop({
    type: {
      label: { type: String },
      link: { type: String },
      background_color: { type: String },
      text_color: { type: String },
      vertical_position: {
        type: String,
        enum: Object.values(CtaVerticalPosition),
        default: CtaVerticalPosition.BOTTOM,
      },
      horizontal_position: {
        type: String,
        enum: Object.values(CtaHorizontalPosition),
        default: CtaHorizontalPosition.CENTER,
      },
    },
    _id: false,
    default: null,
  })
  cta: {
    label: string;
    link: string;
    background_color?: string;
    text_color?: string;
    vertical_position?: CtaVerticalPosition;
    horizontal_position?: CtaHorizontalPosition;
  } | null;

  // ── Mobile-specific text overlay fields ──────────────────────────────────
  @Prop()
  title_mobile: string;

  @Prop()
  subtitle_mobile: string;

  @Prop()
  text_align_mobile: string;

  @Prop()
  text_color_mobile: string;

  @Prop({
    type: {
      label: { type: String },
      link: { type: String },
      background_color: { type: String },
      text_color: { type: String },
      vertical_position: {
        type: String,
        enum: Object.values(CtaVerticalPosition),
        default: CtaVerticalPosition.BOTTOM,
      },
      horizontal_position: {
        type: String,
        enum: Object.values(CtaHorizontalPosition),
        default: CtaHorizontalPosition.CENTER,
      },
    },
    _id: false,
    default: null,
  })
  cta_mobile: {
    label: string;
    link: string;
    background_color?: string;
    text_color?: string;
    vertical_position?: CtaVerticalPosition;
    horizontal_position?: CtaHorizontalPosition;
  } | null;

  // ── Page assignment ───────────────────────────────────────────────────────
  @Prop({
    type: String,
    enum: Object.values(BannerPage),
    default: BannerPage.HOME,
  })
  page: BannerPage;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: false })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
