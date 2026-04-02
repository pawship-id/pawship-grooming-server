import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AppliesTo, DiscountType } from './create-promotion.dto';

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
  @IsEnum(AppliesTo, {
    message: 'applies_to must be service, addon, pickup, or booking',
  })
  applies_to?: AppliesTo;

  @IsOptional()
  @IsEnum(DiscountType, {
    message: 'discount_type must be percent or fixed',
  })
  discount_type?: DiscountType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'is_available_to_membership must be a boolean' })
  is_available_to_membership?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'is_stackable must be a boolean' })
  is_stackable?: boolean;
}
