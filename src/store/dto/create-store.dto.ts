import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CapacityDto,
  ContactDto,
  LocationDto,
  OperationalDto,
  ZoneItemDto,
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
  @IsArray()
  @IsString({ each: true })
  sessions?: string[] = [];

  @IsOptional()
  @IsBoolean({ message: 'is_default_store must be a boolean' })
  is_default_store?: boolean = false;

  @IsOptional()
  @IsBoolean({ message: 'is_pick_up_available must be a boolean' })
  is_pick_up_available?: boolean = false;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsArray({ message: 'zones must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ZoneItemDto)
  zones?: ZoneItemDto[] = [];
}
