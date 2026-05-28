import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ParentItemDto {
  @IsOptional()
  @IsString()
  item?: string;

  @IsOptional()
  @IsBoolean()
  item_in?: boolean;

  @IsOptional()
  @IsBoolean()
  item_out?: boolean;
}
