import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BannerPage } from '../entities/banner.entity';

export class GetBannersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(BannerPage, {
    message: `page must be one of: ${Object.values(BannerPage).join(', ')}`,
  })
  page_filter?: BannerPage;
}
