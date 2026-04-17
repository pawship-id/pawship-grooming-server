import { IsOptional, IsString } from 'class-validator';

export class GetStoreDailyCapacitiesDto {
  @IsOptional()
  @IsString()
  store_id?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
