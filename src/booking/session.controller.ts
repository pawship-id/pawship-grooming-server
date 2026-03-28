import {
  Controller,
  Patch,
  Param,
  BadRequestException,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionService } from './session.service';
import { ObjectId } from 'mongodb';
import { GroomingMediaDto } from './dto/grooming-media.dto';
import {
  UpdateSessionDto,
  FinishSessionDto,
} from './dto/update-grooming-session.dto';
import { CreateSessionDto } from './dto/create-grooming-session.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('bookings')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  // ==================== SESSION ENDPOINTS ====================

  // Create a new session for a booking
  @Post(':bookingId/session')
  async createSession(
    @Param('bookingId') bookingId: string,
    @Body() body: CreateSessionDto,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.createSession(_bookingId, body);

    return {
      message: 'Session created successfully',
    };
  }

  // Update a session by ID
  @Patch(':bookingId/session/:sessionId')
  async updateSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateSessionDto,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.updateSession(_bookingId, _sessionId, body);

    return {
      message: 'Session updated successfully',
    };
  }

  // Delete a session by ID
  @Delete(':bookingId/session/:sessionId')
  async deleteSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.deleteSession(_bookingId, _sessionId);

    return {
      message: 'Session deleted successfully',
    };
  }

  // Start a session by ID
  @Patch(':bookingId/session/:sessionId/start')
  async startSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.startSession(
      _bookingId,
      _sessionId,
      request.user,
    );

    return {
      message: 'Session started successfully',
    };
  }

  // Finish a session by ID
  @Patch(':bookingId/session/:sessionId/finish')
  async finishSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: FinishSessionDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.finishSession(
      _bookingId,
      _sessionId,
      body.notes,
      request.user,
    );

    return {
      message: 'Session finished successfully',
    };
  }

  // Upload media for a specific session
  @Post(':bookingId/session/:sessionId/media')
  @UseInterceptors(FileInterceptor('image'))
  async uploadSessionMedia(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GroomingMediaDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');
    if (!file) throw new BadRequestException('image file is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.uploadSessionMedia(
      _bookingId,
      _sessionId,
      file,
      body,
      request.user,
    );

    return {
      message: 'Media uploaded successfully',
    };
  }

  // Upload media for a booking (booking-level)
  @Post(':bookingId/media')
  @UseInterceptors(FileInterceptor('image'))
  async uploadBookingMedia(
    @Param('bookingId') bookingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GroomingMediaDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!file) throw new BadRequestException('image file is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.uploadBookingMedia(
      _bookingId,
      file,
      body,
      request.user,
    );

    return {
      message: 'Media uploaded successfully',
    };
  }

  // Delete a media item from a booking (matched by public_id)
  @Delete(':bookingId/media')
  async deleteBookingMedia(
    @Param('bookingId') bookingId: string,
    @Query('public_id') publicId: string,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!publicId) throw new BadRequestException('public_id is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.deleteBookingMedia(_bookingId, publicId);

    return {
      message: 'Media deleted successfully',
    };
  }
}
