import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsDateString,
} from 'class-validator';

export class CreatePetMembershipDto {
  @IsNotEmpty({ message: 'pet_id is required' })
  @IsMongoId({ message: 'pet_id must be a valid MongoDB ID' })
  pet_id: string;

  @IsNotEmpty({ message: 'membership_plan_id is required' })
  @IsMongoId({ message: 'membership_plan_id must be a valid MongoDB ID' })
  membership_plan_id: string;
}
