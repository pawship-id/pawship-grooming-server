import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStoreDailyCapacityDto {
  @IsMongoId({ message: 'store must be a valid ID' })
  @IsNotEmpty({ message: 'store is required' })
  store_id: string;

  @IsNotEmpty({ message: 'date is required' })
  date: Date;

  @IsNumber()
  @IsNotEmpty({ message: 'total capacity minutes is required' })
  total_capacity_minutes: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsMongoId()
  created_by?: string;
}
