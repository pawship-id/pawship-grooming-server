import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../dto/user.dto';

export type UserDocument = HydratedDocument<User>;

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
}

// ── Address ──────────────────────────────────────────────────────────────────

export enum AddressCreatedBy {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

@Schema({ _id: true, minimize: true })
export class UserAddress {
  /** e.g. 'Home', 'Office' */
  @Prop()
  label?: string;

  /** Street name and number */
  @Prop()
  street?: string;

  /** Subdistrict (Kelurahan/Desa) */
  @Prop()
  subdistrict?: string;

  /** District (Kecamatan) */
  @Prop()
  district?: string;

  /** City or Regency (Kota/Kabupaten) */
  @Prop()
  city?: string;

  /** Province */
  @Prop()
  province?: string;

  /** Postal code */
  @Prop()
  postal_code?: string;

  /** Additional note for courier/driver */
  @Prop()
  note?: string;

  @Prop({ type: Number })
  latitude?: number;

  @Prop({ type: Number })
  longitude?: number;

  /** Is this the main address? */
  @Prop({ default: false })
  is_main_address?: boolean;

  /** Who created this address */
  @Prop({
    enum: Object.values(AddressCreatedBy),
    default: AddressCreatedBy.CUSTOMER,
  })
  created_by?: string;
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

@Schema({ _id: false, minimize: true })
export class UserProfile {
  @Prop()
  full_name?: string;

  @Prop()
  image_url?: string;

  @Prop()
  public_id?: string;

  @Prop({ enum: Object.values(Gender) })
  gender?: Gender;

  /** Admin / Ops / Groomer — ref: Store */
  @Prop({ type: Types.ObjectId, ref: 'Store' })
  placement?: Types.ObjectId;

  /** Groomer only */
  @Prop({ type: [String] })
  groomer_skills?: string[];

  @Prop({ type: Number })
  groomer_rating?: number;

  /** Customer only — ref: Option */
  @Prop({ type: Types.ObjectId, ref: 'Option' })
  customer_category_id?: Types.ObjectId;

  @Prop({ type: [String] })
  tags?: string[];

  /** Multiple addresses */
  @Prop({ type: [UserAddressSchema], default: [] })
  addresses?: UserAddress[];
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

// ── User ─────────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ sparse: true, unique: true })
  email?: string;

  @Prop({ required: true, unique: true })
  phone_number: string;

  @Prop({ type: String })
  password?: string;

  @Prop({ enum: Object.values(UserRole), default: UserRole.CUSTOMER })
  role: string;

  @Prop({ type: UserProfileSchema })
  profile?: UserProfile;

  @Prop({ default: true })
  is_active: boolean;

  /** true = user has never logged in (e.g. created by admin). null/undefined treated as true for backward compat. */
  @Prop({ type: Boolean, default: null })
  is_idle?: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  refresh_token: string;

  @Prop({ default: null })
  refresh_token_expires_at: Date;

  @Prop({ default: null, index: true })
  password_setup_token?: string;

  @Prop({ default: null })
  password_setup_token_expires_at?: Date;

  @Prop({ default: null })
  deletedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
