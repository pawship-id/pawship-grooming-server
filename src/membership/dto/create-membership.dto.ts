import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateMembershipDto {
  @IsNotEmpty({ message: 'name membership is required' })
  name: string;

  @IsOptional()
  description: string;

  @IsArray()
  @IsMongoId({ each: true, message: 'each pet type must be a valid ID' })
  @IsOptional()
  pet_type_ids?: string[];

  @Type(() => Number)
  @IsNumber({}, { message: 'duration months must be a number' })
  @Min(1, { message: 'duration months must be at least 1 month' })
  duration_months: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price cannot be negative' })
  price: number;

  @IsOptional()
  max_usage: number;

  @IsArray()
  @IsMongoId({ each: true, message: 'each service include must be a valid ID' })
  @IsOptional()
  service_include_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
