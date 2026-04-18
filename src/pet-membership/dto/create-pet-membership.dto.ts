import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreatePetMembershipDto {
  @IsNotEmpty({ message: 'pet_id is required' })
  @IsMongoId({ message: 'pet_id must be a valid MongoDB ID' })
  pet_id: string;

  @IsNotEmpty({ message: 'membership_plan_id is required' })
  @IsMongoId({ message: 'membership_plan_id must be a valid MongoDB ID' })
  membership_plan_id: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchase_price?: number;

  @IsOptional()
  purchase_note?: string;
}
