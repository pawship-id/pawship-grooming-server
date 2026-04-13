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
  HomeServiceZoneDto,
  PickupDeliveryZoneDto,
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
  @IsArray({ message: 'sessions must be an array' })
  @IsString({ each: true })
  sessions?: string[] = [];

  @IsOptional()
  @IsBoolean({ message: 'is_default_store must be a boolean' })
  is_default_store?: boolean = false;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsBoolean({ message: 'is_pickup_delivery_available must be a boolean' })
  is_pickup_delivery_available?: boolean = false;

  @IsOptional()
  @IsArray({ message: 'home_service_zones must be an array' })
  @ValidateNested({ each: true })
  @Type(() => HomeServiceZoneDto)
  home_service_zones?: HomeServiceZoneDto[] = [];

  @IsOptional()
  @IsArray({ message: 'pickup_delivery_zones must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PickupDeliveryZoneDto)
  pickup_delivery_zones?: PickupDeliveryZoneDto[] = [];
}
