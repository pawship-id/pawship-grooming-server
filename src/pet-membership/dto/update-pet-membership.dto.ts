import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsDateString } from 'class-validator';
import { CreatePetMembershipDto } from './create-pet-membership.dto';

export class UpdatePetMembershipDto extends PartialType(
  CreatePetMembershipDto,
) {
  @IsOptional()
  @IsDateString({}, { message: 'start_date must be a valid ISO date string' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_date must be a valid ISO date string' })
  end_date?: string;
}
