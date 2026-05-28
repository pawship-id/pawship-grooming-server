import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { ParentItemDto } from './parent-item.dto';

export class UpdateBroughtItemsNoteDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParentItemDto)
  parent_items?: ParentItemDto[];
}
