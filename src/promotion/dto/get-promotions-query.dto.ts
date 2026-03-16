import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ClaimType, PromoType } from './create-promotion.dto';

export class GetPromotionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'search must be a string' })
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;

  @IsOptional()
  @IsEnum(PromoType, {
    message: 'promo_type must be membership_benefit or general_promo',
  })
  promo_type?: PromoType;

  @IsOptional()
  @IsEnum(ClaimType, {
    message:
      'claim_type must be once_per_membership, every_add_on, or once_per_booking',
  })
  claim_type?: ClaimType;
}
