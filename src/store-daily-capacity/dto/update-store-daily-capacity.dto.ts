import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreDailyCapacityDto } from './create-store-daily-capacity.dto';

export class UpdateStoreDailyCapacityDto extends PartialType(
  CreateStoreDailyCapacityDto,
) {}
