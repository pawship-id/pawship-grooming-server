import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListGroomerMyJobsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  session_status?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}

export class ListGroomerOpenJobsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  // YYYY-MM-DD inclusive range. Defaults to today on the server when both are absent.
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  // Explicit store override. Ignored if user is a groomer with a placement
  // (groomer placement always wins to enforce branch scoping).
  @IsOptional()
  @IsString()
  store_id?: string;

  // When "1"/"true", skip the default date filter (used by reusable callers
  // like the urgent dashboard that want overdue / cross-day windows).
  @IsOptional()
  @IsString()
  scope?: string;
}
