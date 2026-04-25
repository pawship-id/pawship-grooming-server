import { IsString, IsOptional } from 'class-validator';

export class UpdateBookingNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}
