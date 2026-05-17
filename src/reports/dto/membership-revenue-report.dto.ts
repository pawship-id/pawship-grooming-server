import { IsIn, IsOptional, IsString } from 'class-validator';

export class MembershipRevenueReportDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  /** Grouping granularity for the reporting period. Defaults to 'month'. */
  @IsOptional()
  @IsIn(['month', 'week'])
  period?: 'month' | 'week';
}
