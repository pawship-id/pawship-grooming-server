import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class BookingPreviewRequestDto {
  @IsNotEmpty({ message: 'pet_id is required' })
  @IsMongoId({ message: 'pet_id must be a valid MongoDB ID' })
  pet_id: string;

  @IsNotEmpty({ message: 'service_id is required' })
  @IsMongoId({ message: 'service_id must be a valid MongoDB ID' })
  service_id: string;

  @IsOptional()
  @IsArray({ message: 'addon_ids must be an array' })
  @IsMongoId({
    each: true,
    message: 'each addon ID must be a valid MongoDB ID',
  })
  addon_ids?: string[];

  @IsNotEmpty({ message: 'date is required' })
  date: Date;

  @IsOptional()
  time_range?: string;
}

export class PreviewBenefitDto {
  _id: string;
  applies_to: string; // service, addon, pickup
  service_id?: string;
  label?: string;
  service?: any;
  type: string; // discount, quota
  period: string; // weekly, monthly, unlimited
  value?: number;
  limit: number | null;
  used: number;
  remaining: number | null;
  can_apply: boolean;
  period_reset_date: Date | null;
  next_reset_date: Date | null;
  amount_discount?: number; // calculated discount amount
  description: string;
}

export class BookingPreviewResponseDto {
  message: string;
  data: {
    service_id: string;
    service_name: string;
    original_price: number;
    addon_prices: {
      addon_id: string;
      addon_name: string;
      price: number;
    }[];
    subtotal_before_benefits: number;
    has_active_membership: boolean;
    available_benefits: PreviewBenefitDto[];
    estimated_discount: number; // total possible discount jika semua benefit diapply
    estimated_final_price: number;
    pricing_breakdown: {
      original_price: number;
      subtotal_addons: number;
      subtotal_before_benefits: number;
      total_possible_discount: number;
      estimated_final_price: number;
    };
  };
}
