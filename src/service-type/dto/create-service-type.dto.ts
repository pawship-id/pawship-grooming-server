import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateServiceTypeDto {
  @IsNotEmpty({ message: 'title is required' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image_url: string;

  @IsOptional()
  @IsString()
  public_id: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  show_in_homepage?: boolean;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  store_ids?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'order must be a number' })
  order?: number;
}
