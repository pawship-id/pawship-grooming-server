import { IsOptional, IsString } from 'class-validator';

export class CapacityUtilisationReportDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  store_id?: string;
}
