import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { GuestService } from './guest.service';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { CreateGuestPetDto } from './dto/create-guest-pet.dto';
import { Public } from 'src/auth/public.decorator';
import { CreateBookingDto } from 'src/booking/dto/create-booking.dto';
import { BookingService } from 'src/booking/booking.service';
import { StoreService } from 'src/store/store.service';
import { ServiceService } from 'src/service/service.service';

@Controller('guest')
@Public()
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly bookingService: BookingService,
    private readonly storeService: StoreService,
    private readonly serviceService: ServiceService,
  ) {}

  // Step 1: Get all stores
  @Get('stores')
  async getStores() {
    const stores = await this.storeService.findAll();
    return {
      message: 'Fetch stores successfully',
      stores,
    };
  }

  // Step 2 & 3: Get services by store and type (grooming/addon)
  @Get('services')
  async getServices(
    @Query('store_id') storeId?: string,
    @Query('type') type?: string,
  ) {
    const services = await this.serviceService.findAllForGuest(storeId, type);
    return {
      message: 'Fetch services successfully',
      services,
    };
  }

  // Step 5: Check if user exists by phone number
  @Get('check-user/phone/:phone_number')
  async checkUser(@Param('phone_number') phone_number: string) {
    if (!phone_number)
      throw new BadRequestException('phone number is required');

    const result = await this.guestService.checkUserByPhone(phone_number);
    return {
      message: result.exists ? 'User found' : 'User not found, please register',
      ...result,
    };
  }

  // Step 7: Register new guest user with pet
  @Post('register')
  async registerGuest(@Body() dto: RegisterGuestDto) {
    const result = await this.guestService.registerGuestUser(dto);
    return {
      message:
        'User and pet registered successfully. Welcome email has been sent.',
      ...result,
    };
  }

  // Create pet for existing guest user
  @Post('pets')
  async createPetForGuest(@Body() dto: CreateGuestPetDto) {
    const result = await this.guestService.createPetForGuest(dto);
    return {
      message: 'Pet created successfully',
      ...result,
    };
  }

  // Step 8: Create guest booking
  @Post('bookings')
  async createGuestBooking(@Body() body: CreateBookingDto) {
    await this.bookingService.create(body);
    return {
      message: 'Guest booking created successfully',
    };
  }
}
