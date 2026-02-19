import {
  Controller,
  Patch,
  Param,
  BadRequestException,
  NotFoundException,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GroomingSessionService } from './grooming-session.service';
import { ObjectId } from 'mongodb';
import { BookingService } from './booking.service';
import { GroomingMediaDto } from './dto/grooming-media.dto';

@Controller('booking/grooming-session')
export class GroomingSessionController {
  constructor(
    private readonly groomingSessionService: GroomingSessionService,
    private readonly bookingService: BookingService,
  ) {}

  @Patch('arrive/:id')
  async arriveGroommer(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    await this.groomingSessionService.arriveGroomer(_id);

    return {
      message: 'Grooming session finished successfully',
    };
  }

  @Patch('start/:id')
  async startGrooming(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    await this.groomingSessionService.startGrooming(_id);

    return {
      message: 'Grooming session started successfully',
    };
  }

  @Patch('finish/:id')
  async finishGrooming(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const booking = await this.bookingService.findOne(_id);
    if (!booking || booking.isDeleted)
      throw new NotFoundException('data not found');

    await this.groomingSessionService.finishGrooming(_id);

    return {
      message: 'Grooming session finished successfully',
    };
  }

  @Post('media/:id')
  @UseInterceptors(FileInterceptor('image'))
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GroomingMediaDto,
  ) {
    if (!id) throw new BadRequestException('id is required');
    if (!file) throw new BadRequestException('image file is required');

    const _id = new ObjectId(id);
    await this.groomingSessionService.uploadMedia(_id, file, body);

    return {
      message: 'Media uploaded successfully',
    };
  }
}
