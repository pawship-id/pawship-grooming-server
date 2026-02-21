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
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { AssignedGroomerDto, CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ObjectId } from 'mongodb';
import { BookingStatus } from './dto/booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async create(@Body() body: CreateBookingDto, @Req() request: any) {
    await this.bookingService.create(body, request.user);

    return {
      message: 'Create booking successfully',
    };
  }

  @Get()
  async findAll() {
    const bookings = await this.bookingService.findAll();

    return {
      message: 'Fetch bookings successfully',
      bookings,
    };
  }

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

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBookingDto,
    @Req() request: any,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    await this.bookingService.update(_id, body, request.user);

    return {
      message: 'Update booking successfully',
    };
  }

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
