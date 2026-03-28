import { IsNotEmpty, IsDateString } from 'class-validator';

export class UpdatePetMembershipDto {
  @IsNotEmpty({ message: 'start_date is required' })
  @IsDateString({}, { message: 'start_date must be a valid ISO date string' })
  start_date: string;

  @IsNotEmpty({ message: 'end_date is required' })
  @IsDateString({}, { message: 'end_date must be a valid ISO date string' })
  end_date: string;
}
