import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  BadRequestException,
  NotFoundException,
  Put,
  Patch,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { AssignedGroomerDto, CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ObjectId } from 'mongodb';
import { BookingStatus } from './dto/booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';
import { GuestService } from './guest.service';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { CreateGuestPetDto } from './dto/create-guest-pet.dto';
import { StoreService } from 'src/store/store.service';
import { ServiceService } from 'src/service/service.service';
import { OptionService } from 'src/option/option.service';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly guestService: GuestService,
    private readonly storeService: StoreService,
    private readonly serviceService: ServiceService,
    private readonly optionService: OptionService,
  ) {}

  // ─── Public (Guest) Endpoints ──────────────────────────────────────────────

  // Get all stores with service types (public)
  @Public()
  @Get('public/stores')
  async getPublicStores() {
    const result = await this.storeService.findAllWithServiceTypes();
    return {
      message: 'Fetch stores successfully',
      ...result,
    };
  }

  // Get services by store and type (public)
  @Public()
  @Get('public/services')
  async getPublicServices(
    @Query('store_id') storeId?: string,
    @Query('service_type_id') service_type_id?: string,
  ) {
    const services = await this.serviceService.findAllForGuest(
      storeId,
      service_type_id,
    );
    return {
      message: 'Fetch services successfully',
      services,
    };
  }

  // Check if user exists by phone number (public)
  @Public()
  @Get('public/option')
  async getPublicOptions(@Query('category') category?: string) {
    const options = await this.optionService.findAll(category);
    return { message: 'Fetch options successfully', options };
  }

  @Public()
  @Get('public/check-user/phone/:phone_number')
  async checkUserByPhone(@Param('phone_number') phone_number: string) {
    if (!phone_number)
      throw new BadRequestException('phone number is required');

    const result = await this.guestService.checkUserByPhone(phone_number);
    return {
      message: result.exists ? 'User found' : 'User not found, please register',
      ...result,
    };
  }

  // Register new guest user with pet (public)
  @Public()
  @Post('public/register')
  async registerGuest(@Body() dto: RegisterGuestDto) {
    const result = await this.guestService.registerGuestUser(dto);
    return {
      message:
        'User and pet registered successfully. Welcome email has been sent.',
      ...result,
    };
  }

  // Create pet for existing guest user (public)
  @Public()
  @Post('public/pets')
  async createPetForGuest(@Body() dto: CreateGuestPetDto) {
    const result = await this.guestService.createPetForGuest(dto);
    return {
      message: 'Pet created successfully',
      ...result,
    };
  }

  // Create guest booking (public)
  @Public()
  @Post('public')
  async createGuestBooking(@Body() body: CreateBookingDto) {
    await this.bookingService.create(body);
    return {
      message: 'Guest booking created successfully',
    };
  }

  // ─── Admin Endpoints ────────────────────────────────────────────────────────

  // create booking (admin)
  @Post()
  async create(@Body() body: CreateBookingDto, @Req() request: any) {
    await this.bookingService.create(body, request.user);

    return {
      message: 'Create booking successfully',
    };
  }

  // get all booking (admin)
  @Get()
  async findAll() {
    const bookings = await this.bookingService.findAll();

    return {
      message: 'Fetch bookings successfully',
      bookings,
    };
  }

  // get booking by id (admin)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch booking successfully',
      booking,
    };
  }

  // update booking by id (admin)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBookingDto,
    @Req() request: any,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    await this.bookingService.update(_id, body, request.user);

    return {
      message: 'Update booking successfully',
    };
  }

  // soft delete booking by id (admin)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    await this.bookingService.remove(_id);

    return {
      message: 'Delete booking successfully',
    };
  }

  // assign groomer
  @Patch('/assign-groomer/:id')
  async assignGroomer(
    @Param('id') id: string,
    @Body('assigned_groomers') assigned_groomers: AssignedGroomerDto[],
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);

    await this.bookingService.assignGroomer(_id, assigned_groomers);

    return {
      message: 'Assign groomer successfully',
    };
  }

  // update status booking
  @Patch('update-status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
    @Req() request: any,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    const { status, date, time_range, note } = body;

    const rescheduleData =
      date && time_range ? { date, time_range } : undefined;

    await this.bookingService.updateStatus(
      _id,
      status as BookingStatus,
      note,
      rescheduleData,
      request.user,
    );

    return {
      message: 'Update status booking successfully',
    };
  }
}
