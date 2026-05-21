import { IsString, IsOptional } from 'class-validator';

export class UpdateBroughtItemsNoteDto {
  @IsOptional()
  @IsString()
  brought_items_note?: string;
}
