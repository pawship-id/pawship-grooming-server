import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerDto } from './create-banner.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBannerDto extends PartialType(CreateBannerDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
