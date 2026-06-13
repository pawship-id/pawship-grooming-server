import { IsIn, IsOptional } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

export class CustomerTrendQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsIn(['week', 'month'])
  granularity?: 'week' | 'month';
}
