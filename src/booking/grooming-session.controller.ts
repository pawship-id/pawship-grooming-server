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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GroomingSessionService } from './grooming-session.service';
import { ObjectId } from 'mongodb';
import { GroomingMediaDto } from './dto/grooming-media.dto';
import {
  UpdateSessionDto,
  FinishSessionDto,
} from './dto/update-grooming-session.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('bookings')
@UseGuards(AuthGuard)
export class GroomingSessionController {
  constructor(
    private readonly groomingSessionService: GroomingSessionService,
  ) {}

  // ==================== SESSION ENDPOINTS ====================
  // Sessions are auto-created when groomers are assigned
  // Use update, start, finish endpoints to manage existing sessions

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
    await this.groomingSessionService.updateSession(
      _bookingId,
      _sessionId,
      body,
    );

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
    await this.groomingSessionService.deleteSession(_bookingId, _sessionId);

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
    await this.groomingSessionService.startSession(
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
    await this.groomingSessionService.finishSession(
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
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');
    if (!file) throw new BadRequestException('image file is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.groomingSessionService.uploadSessionMedia(
      _bookingId,
      _sessionId,
      file,
      body,
    );

    return {
      message: 'Media uploaded successfully',
    };
  }
}
