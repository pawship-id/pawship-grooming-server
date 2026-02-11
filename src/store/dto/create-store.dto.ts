import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CapacityDto,
  ContactDto,
  LocationDto,
  OperationalDto,
} from './store.dto';

export class CreateStoreDto {
  @IsNotEmpty({ message: 'code is required' })
  code: string;

  @IsNotEmpty({ message: 'name store is required' })
  name: string;

  @IsOptional()
  description: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalDto)
  operational?: OperationalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CapacityDto)
  capacity?: CapacityDto;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
