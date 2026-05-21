import { IsOptional, IsString } from 'class-validator';

export class CustomerReportDto {
  @IsOptional()
  @IsString()
  search?: string;
}
