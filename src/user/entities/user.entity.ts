import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../dto/user.dto';

export type UserDocument = HydratedDocument<User>;

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
}

// ── Address ──────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class UserAddress {
  @Prop({ default: null })
  street: string;

  @Prop({ default: null })
  city: string;

  @Prop({ default: null })
  zone: string;
}

export const UserAddressSchema = SchemaFactory.createForClass(UserAddress);

// ── Profile ──────────────────────────────────────────────────────────────────
// All role-specific fields are stored in a single subdocument.
// Which fields apply per role is enforced at the DTO / service layer.
//
//  Admin / Ops : full_name, image_url, public_id, gender, placement, tags, address
//  Groomer     : full_name, image_url, public_id, gender, placement,
//                groomer_skills, groomer_rating, tags, address
//  Customer    : full_name, image_url, public_id, gender,
//                customer_category_id, tags, address

@Schema({ _id: false })
export class UserProfile {
  @Prop({ default: null })
  full_name: string;

  @Prop({ default: null })
  image_url: string;

  @Prop({ default: null })
  public_id: string;

  @Prop({ enum: Object.values(Gender), default: null })
  gender: Gender;

  /** Admin / Ops / Groomer — ref: Store */
  @Prop({ type: Types.ObjectId, ref: 'Store', default: null })
  placement: Types.ObjectId;

  /** Groomer only */
  @Prop({ type: [String], default: [] })
  groomer_skills: string[];

  @Prop({ type: Number, default: null })
  groomer_rating: number;

  /** Customer only — ref: Option */
  @Prop({ type: Types.ObjectId, ref: 'Option', default: null })
  customer_category_id: Types.ObjectId;

  /** Shared across all roles */
  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: UserAddressSchema, default: () => ({}) })
  address: UserAddress;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

// ── User ─────────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  phone_number: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ enum: Object.values(UserRole), default: UserRole.CUSTOMER })
  role: string;

  @Prop({ type: UserProfileSchema, default: () => ({}) })
  profile: UserProfile;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  refresh_token: string;

  @Prop({ default: null })
  refresh_token_expires_at: Date;

  @Prop({ default: null })
  deletedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
