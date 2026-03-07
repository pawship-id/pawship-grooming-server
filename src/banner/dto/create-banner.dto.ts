import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import {
  CtaHorizontalPosition,
  CtaVerticalPosition,
} from '../entities/banner.entity';

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
  @IsNotEmpty({ message: 'image_url is required' })
  @IsString()
  image_url: string;

  @IsNotEmpty({ message: 'public_id is required' })
  @IsString()
  public_id: string;

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

  @IsOptional()
  @IsNumber()
  order?: number;
}
