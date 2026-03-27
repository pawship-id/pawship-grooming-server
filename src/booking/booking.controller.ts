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
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingPreviewRequestDto } from './dto/booking-preview.dto';
import { ObjectId } from 'mongodb';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';
import { GuestService } from './guest.service';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { CreateGuestPetDto } from './dto/create-guest-pet.dto';
import { StoreService } from 'src/store/store.service';
import { ServiceService } from 'src/service/service.service';
import { OptionService } from 'src/option/option.service';
import { PetMembershipService } from 'src/pet-membership/pet-membership.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { ApplyBenefitPreviewDto } from './dto/apply-benefit-preview.dto';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly guestService: GuestService,
    private readonly storeService: StoreService,
    private readonly serviceService: ServiceService,
    private readonly optionService: OptionService,
    private readonly petMembershipService: PetMembershipService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
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
  @Get('public/options')
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

    if (!result.exists) {
      throw new NotFoundException('data not found');
    }

    return {
      message: 'User found',
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

  // Create booking only customer (public)
  @Public()
  @Post('public')
  async createGuestBooking(@Body() body: any, @Req() request: any) {
    let user: { username: string; role: string } | undefined;

    // try to extract and verify token if present
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7); // Remove 'Bearer ' prefix
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET_KEY'),
        });
        user = payload;

        body.customer_id = payload._id;
      } catch (error) {
        // token is invalid or expired, proceed as guest
        console.warn('Invalid token provided, proceeding as guest');
      }
    }

    // if the user is not logged in
    if (!user) {
      // and does not send customer_id
      if (!body.customer_id) {
        // throw bad request
        throw new BadRequestException('customer_id is required');
      }

      // find one user by customer_id (because even if the user hasn't logged in, the user data has already been created)
      let find_user = await this.userService.findById(
        new ObjectId(body.customer_id),
      );

      if (find_user) {
        user = find_user;
      }
    }

    // Remove travel_fee if present in body (should always be from zone)
    if ('travel_fee' in body) {
      delete body.travel_fee;
    }
    await this.bookingService.create(body, user);

    return {
      message: 'Booking created successfully',
    };
  }

  // Preview benefit application (public, no booking required)
  @Public()
  @Post('public/apply-benefit')
  async previewApplyBenefit(@Body() dto: ApplyBenefitPreviewDto) {
    const result = await this.bookingService.previewApplyBenefits(
      dto.pet_id,
      dto.selected_benefit_ids,
      dto.store_id,
      dto.service_id,
      dto.add_on_ids,
      dto.original_total_price,
    );
    return {
      message: 'Benefit preview calculated successfully',
      ...result,
    };
  }

  // ─── Admin Endpoints ────────────────────────────────────────────────────────

  // booking preview with benefit calculation
  @Post('preview')
  async preview(@Body() dto: BookingPreviewRequestDto, @Req() request: any) {
    const preview = await this.bookingService.getBookingPreview(dto);

    return {
      message: 'Booking preview calculated successfully',
      ...preview,
    };
  }

  // create booking (admin)
  @Post()
  async create(@Body() body: CreateBookingDto, @Req() request: any) {
    if (!body.customer_id) {
      throw new BadRequestException('customer_id is required');
    }

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
      status,
      note,
      rescheduleData,
      request.user,
    );

    return {
      message: 'Update status booking successfully',
    };
  }
}
