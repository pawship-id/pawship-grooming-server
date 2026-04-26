import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class RenewPetMembershipDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchase_price?: number;
}
