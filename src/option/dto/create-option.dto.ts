import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsMongoId,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryOption } from './option.dto';

export class PetWeightRuleDto {
  @IsNumber()
  @IsNotEmpty({ message: 'minWeight is required' })
  minWeight: number;

  @IsNumber()
  @IsNotEmpty({ message: 'maxWeight is required' })
  maxWeight: number;

  @IsMongoId({ message: 'petTypeId must be a valid MongoDB ID' })
  @IsNotEmpty({ message: 'petTypeId is required' })
  petTypeId: string;
}

export class CreateOptionDto {
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsEnum(CategoryOption, {
    message: 'category must be in the options',
  })
  @IsNotEmpty({ message: 'category is required' })
  category_options: string;

  @IsOptional()
  is_active?: boolean;

  @IsOptional()
  @IsArray({ message: 'pet_weight_rules must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PetWeightRuleDto)
  pet_weight_rules?: PetWeightRuleDto[];
}
