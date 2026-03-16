import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { CategoryOption } from './option.dto';

export class CreateOptionDto {
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsEnum(CategoryOption, {
    each: true,
    message: 'category must be in the options',
  })
  @IsNotEmpty({ message: 'category is required' })
  category_options: string;

  @IsOptional()
  is_active?: boolean;
}
