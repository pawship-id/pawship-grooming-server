import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  BannerPage,
  CtaHorizontalPosition,
  CtaVerticalPosition,
} from '../entities/banner.entity';

export class BannerImageDto {
  @IsNotEmpty({ message: 'image_url is required' })
  @IsString()
  image_url: string;

  @IsNotEmpty({ message: 'public_id is required' })
  @IsString()
  public_id: string;
}

export class CtaDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsString()
  link: string;

  @IsOptional()
  @IsString()
  background_color?: string;

  @IsOptional()
  @IsString()
  text_color?: string;

  @IsOptional()
  @IsEnum(CtaVerticalPosition, {
    message: `vertical_position must be one of: ${Object.values(CtaVerticalPosition).join(', ')}`,
  })
  vertical_position?: CtaVerticalPosition;

  @IsOptional()
  @IsEnum(CtaHorizontalPosition, {
    message: `horizontal_position must be one of: ${Object.values(CtaHorizontalPosition).join(', ')}`,
  })
  horizontal_position?: CtaHorizontalPosition;
}

export class CreateBannerDto {
  @IsNotEmpty({ message: 'banner_desktop is required' })
  @ValidateNested()
  @Type(() => BannerImageDto)
  banner_desktop: BannerImageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BannerImageDto)
  banner_mobile?: BannerImageDto;

  @IsOptional()
  @IsBoolean()
  add_text?: boolean = false;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  text_align?: string;

  @IsOptional()
  @IsString()
  text_color?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CtaDto)
  cta?: CtaDto;

  // ── Mobile-specific text overlay fields ────────────────────────────────
  @IsOptional()
  @IsString()
  title_mobile?: string;

  @IsOptional()
  @IsString()
  subtitle_mobile?: string;

  @IsOptional()
  @IsString()
  text_align_mobile?: string;

  @IsOptional()
  @IsString()
  text_color_mobile?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CtaDto)
  cta_mobile?: CtaDto;

  // ── Page assignment ─────────────────────────────────────────────────────
  @IsOptional()
  @IsEnum(BannerPage, {
    message: `page must be one of: ${Object.values(BannerPage).join(', ')}`,
  })
  page?: BannerPage = BannerPage.HOME;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = false;
}
