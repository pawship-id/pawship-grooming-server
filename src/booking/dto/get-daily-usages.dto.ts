import { IsOptional, IsString } from 'class-validator';

export class GetDailyUsagesDto {
  @IsOptional()
  @IsString()
  store_id?: string;

  @IsOptional()
  @IsString()
  date?: string; // ISO date string YYYY-MM-DD

  @IsOptional()
  @IsString()
  start_date?: string; // ISO date string YYYY-MM-DD

  @IsOptional()
  @IsString()
  end_date?: string; // ISO date string YYYY-MM-DD
}
