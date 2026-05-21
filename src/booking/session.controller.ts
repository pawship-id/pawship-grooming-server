import {
  Controller,
  Patch,
  Param,
  BadRequestException,
  Body,
  Post,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { ObjectId } from 'mongodb';
import {
  ConfirmMediaUploadDto,
  ConfirmSessionOtherMediaUploadDto,
  RequestMediaSignatureDto,
  UpdateMediaNotesDto,
} from './dto/grooming-media.dto';
import {
  UpdateSessionDto,
  FinishSessionDto,
} from './dto/update-grooming-session.dto';
import { CreateSessionDto } from './dto/create-grooming-session.dto';
import { ReviewSessionDto } from './dto/review-session.dto';
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

  // Claim an unassigned session (groomer self-assign)
  @Patch(':bookingId/session/:sessionId/claim')
  async claimSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    const _groomerId = new ObjectId(request.user._id);
    await this.sessionService.claimSession(_bookingId, _sessionId, _groomerId);

    return {
      message: 'Session claimed successfully',
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

  // Customer submits a review for a specific session
  @Patch(':bookingId/session/:sessionId/review')
  async reviewSession(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: ReviewSessionDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.reviewSession(
      _bookingId,
      _sessionId,
      request.user._id,
      body,
    );

    return {
      message: 'Review submitted successfully',
    };
  }

  // Issue a Cloudinary signed upload payload for booking-level media.
  // Client then uploads directly to Cloudinary and calls the confirm endpoint.
  @Post(':bookingId/media/sign')
  async signBookingMediaUpload(
    @Param('bookingId') bookingId: string,
    @Body() body: RequestMediaSignatureDto,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');

    const _bookingId = new ObjectId(bookingId);
    return this.sessionService.signBookingMediaUpload(_bookingId, body.type);
  }

  // Persist booking-level media after the client uploaded it to Cloudinary.
  @Post(':bookingId/media/confirm')
  async confirmBookingMediaUpload(
    @Param('bookingId') bookingId: string,
    @Body() body: ConfirmMediaUploadDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.confirmBookingMediaUpload(
      _bookingId,
      body,
      request.user,
    );

    return { message: 'Media uploaded successfully' };
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

  // Issue a Cloudinary signed upload payload for session "other" media.
  // Only admin or the groomer assigned to the session can request a signature.
  @Post(':bookingId/session/:sessionId/media/other/sign')
  async signSessionOtherMediaUpload(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    return this.sessionService.signSessionOtherMediaUpload(
      _bookingId,
      _sessionId,
      request.user,
    );
  }

  // Persist session "other" media after the client uploaded it to Cloudinary.
  @Post(':bookingId/session/:sessionId/media/other/confirm')
  async confirmSessionOtherMediaUpload(
    @Param('bookingId') bookingId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: ConfirmSessionOtherMediaUploadDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const _bookingId = new ObjectId(bookingId);
    const _sessionId = new ObjectId(sessionId);
    await this.sessionService.confirmSessionOtherMediaUpload(
      _bookingId,
      _sessionId,
      body,
      request.user,
    );

    return { message: 'Media uploaded successfully' };
  }

  // Update `notes` caption of an existing booking media item.
  // Admin can edit any media; groomer can only edit media they uploaded.
  @Patch(':bookingId/media/notes')
  async updateBookingMediaNotes(
    @Param('bookingId') bookingId: string,
    @Body() body: UpdateMediaNotesDto,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.updateBookingMediaNotes(
      _bookingId,
      body,
      request.user,
    );

    return { message: 'Notes updated successfully' };
  }

  // Delete booking media with auth check (admin or original uploader)
  @Delete(':bookingId/media/auth')
  async deleteBookingMediaAuth(
    @Param('bookingId') bookingId: string,
    @Query('public_id') publicId: string,
    @Req() request: any,
  ) {
    if (!bookingId) throw new BadRequestException('bookingId is required');
    if (!publicId) throw new BadRequestException('public_id is required');

    const _bookingId = new ObjectId(bookingId);
    await this.sessionService.deleteBookingMediaWithAuth(
      _bookingId,
      publicId,
      request.user,
    );

    return {
      message: 'Media deleted successfully',
    };
  }
}
