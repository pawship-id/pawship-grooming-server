import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Booking, BookingDocument } from './entities/booking.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { BookingStatus, SessionStatus, MediaType } from './dto/booking.dto';
import {
  generateGroomingSessionFolder,
  uploadToCloudinary,
} from 'src/helpers/cloudinary';
import { GroomingMediaDto } from './dto/grooming-media.dto';
import { UpdateSessionDto } from './dto/update-grooming-session.dto';
import { CreateSessionDto } from './dto/create-grooming-session.dto';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ==================== HELPERS ====================

  private async findBookingOrFail(bookingId: ObjectId) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking || booking.isDeleted) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  private assertNotReturned(booking: BookingDocument) {
    if (booking.booking_status === BookingStatus.RETURNED) {
      throw new BadRequestException(
        "Booking dengan status 'returned' tidak dapat diubah lagi.",
      );
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  // Create a new session for a booking
  async createSession(bookingId: ObjectId, dto: CreateSessionDto) {
    const booking = await this.findBookingOrFail(bookingId);
    this.assertNotReturned(booking);

    const order = dto.order ?? booking.sessions.length;

    const newSession = {
      type: dto.type,
      groomer_id: dto.groomer_id ? new Types.ObjectId(dto.groomer_id) : null,
      status: SessionStatus.NOT_STARTED,
      started_at: null,
      finished_at: null,
      notes: null,
      internal_note: null,
      order,
      media: [],
    };

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      { $push: { sessions: newSession } },
      { new: true },
    );

    return updatedBooking;
  }

  // Update an existing session by ID
  async updateSession(
    bookingId: ObjectId,
    sessionId: ObjectId,
    dto: UpdateSessionDto,
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const sessionIndex = booking.sessions.findIndex(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (sessionIndex === -1) {
        throw new NotFoundException('Session not found');
      }

      const updateFields: any = {};
      const basePath = `sessions.${sessionIndex}`;

      if (dto.type) updateFields[`${basePath}.type`] = dto.type;
      if (dto.groomer_id)
        updateFields[`${basePath}.groomer_id`] = new Types.ObjectId(
          dto.groomer_id,
        );
      if (dto.status) updateFields[`${basePath}.status`] = dto.status;
      if (dto.started_at)
        updateFields[`${basePath}.started_at`] = new Date(dto.started_at);
      if (dto.finished_at)
        updateFields[`${basePath}.finished_at`] = new Date(dto.finished_at);
      if (dto.notes) updateFields[`${basePath}.notes`] = dto.notes;
      if (dto.internal_note)
        updateFields[`${basePath}.internal_note`] = dto.internal_note;

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $set: updateFields },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Delete a session by ID
  async deleteSession(bookingId: ObjectId, sessionId: ObjectId) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      // Find the session to get the groomer_id and type
      const session = booking.sessions.find(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // Remove the session from sessions array
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $pull: {
            sessions: { _id: sessionId },
          },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // ==================== CLAIM SESSION ====================

  // Allow a groomer to claim an unassigned session
  async claimSession(
    bookingId: ObjectId,
    sessionId: ObjectId,
    groomerId: ObjectId,
  ) {
    const booking = await this.findBookingOrFail(bookingId);
    this.assertNotReturned(booking);

    const sessionIndex = booking.sessions.findIndex(
      (s: any) => s._id.toString() === sessionId.toString(),
    );

    if (sessionIndex === -1) {
      throw new NotFoundException('Session not found');
    }

    const session = booking.sessions[sessionIndex];

    if (session.groomer_id) {
      throw new ConflictException(
        'Session is already claimed by another groomer',
      );
    }

    // Validate groomer's skills against session type (case-insensitive, name-based)
    const groomer = await this.userModel
      .findById(groomerId)
      .select('profile.groomer_skills')
      .lean();
    const groomerSkills: string[] = groomer?.profile?.groomer_skills || [];
    if (groomerSkills.length > 0) {
      const sessionTypeLower = session.type.toLowerCase();
      const hasSkill = groomerSkills.some(
        (skill) => skill.toLowerCase() === sessionTypeLower,
      );
      if (!hasSkill) {
        throw new ForbiddenException(
          `You do not have the skill "${session.type}" required to claim this session`,
        );
      }
    }

    const basePath = `sessions.${sessionIndex}`;

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          [`${basePath}.groomer_id`]: new Types.ObjectId(groomerId.toString()),
        },
      },
      { new: true },
    );

    return updatedBooking;
  }

  // ==================== WORKFLOW ACTIONS ====================

  // Groomer arrives (for in-home services)
  async arriveGroomer(bookingId: ObjectId) {
    try {
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            booking_status: BookingStatus.ARRIVED,
          },
          $push: {
            status_logs: {
              status: BookingStatus.ARRIVED,
              timestamp: new Date(),
              note: `Status changed to ${BookingStatus.ARRIVED} by the groomer`,
            },
          },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Start a specific session by ID
  async startSession(
    bookingId: ObjectId,
    sessionId: ObjectId,
    user?: { username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const sessionIndex = booking.sessions.findIndex(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (sessionIndex === -1) {
        throw new NotFoundException('Session not found');
      }

      const currentSession = booking.sessions[sessionIndex];

      // Validate: Check if all previous sessions (based on order) are finished
      const previousSessions = booking.sessions.filter(
        (s: any) => s.order < currentSession.order,
      );

      if (previousSessions.length > 0) {
        const unfinishedPrevious = previousSessions.find(
          (s: any) => !s.finished_at || s.status !== SessionStatus.FINISHED,
        );

        if (unfinishedPrevious) {
          throw new BadRequestException(
            `Cannot start this session. Previous session "${unfinishedPrevious.type}" must be completed first.`,
          );
        }
      }

      const basePath = `sessions.${sessionIndex}`;

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            booking_status: BookingStatus.IN_PROGRESS,
            [`${basePath}.status`]: SessionStatus.IN_PROGRESS,
            [`${basePath}.started_at`]: new Date(),
          },
          $push: {
            status_logs: {
              status: BookingStatus.IN_PROGRESS,
              timestamp: new Date(),
              note: `Session ${booking.sessions[sessionIndex].type} started by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
            },
          },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Finish a specific session by ID
  async finishSession(
    bookingId: ObjectId,
    sessionId: ObjectId,
    notes?: string,
    user?: { username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const sessionIndex = booking.sessions.findIndex(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (sessionIndex === -1) {
        throw new NotFoundException('Session not found');
      }

      const currentSession = booking.sessions[sessionIndex];

      // Validate: Session must be started before it can be finished
      if (
        !currentSession.started_at ||
        currentSession.status === SessionStatus.NOT_STARTED
      ) {
        throw new BadRequestException(
          `Cannot finish this session. Session "${currentSession.type}" must be started first.`,
        );
      }

      const basePath = `sessions.${sessionIndex}`;
      const updateFields: any = {
        [`${basePath}.status`]: SessionStatus.FINISHED,
        [`${basePath}.finished_at`]: new Date(),
      };

      if (notes) {
        updateFields[`${basePath}.notes`] = notes;
      }

      // Check if all sessions will be complete after this
      const allSessionsComplete = booking.sessions.every(
        (s: any, idx) =>
          idx === sessionIndex || s.status === SessionStatus.FINISHED,
      );

      if (allSessionsComplete) {
        updateFields.booking_status = BookingStatus.COMPLETED;
      }

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: updateFields,
          $push: {
            status_logs: {
              status: allSessionsComplete
                ? BookingStatus.COMPLETED
                : BookingStatus.IN_PROGRESS,
              timestamp: new Date(),
              note: `Session ${booking.sessions[sessionIndex].type} finished by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
            },
          },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // ==================== MEDIA MANAGEMENT ====================

  // Upload media for a specific session by ID
  async uploadSessionMedia(
    bookingId: ObjectId,
    sessionId: ObjectId,
    file: Express.Multer.File,
    body: GroomingMediaDto,
    user?: { _id: ObjectId; username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const sessionIndex = booking.sessions.findIndex(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (sessionIndex === -1) {
        throw new NotFoundException('Session not found');
      }

      // Convert buffer to base64 for Cloudinary
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(
        base64Image,
        generateGroomingSessionFolder(booking.pet_snapshot.name, body.type),
      );

      const mediaItem = {
        type: body.type,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        created_by: {
          user_id: user?._id,
          name_snapshot: user?.username,
        },
        note: body.note || '',
        uploaded_at: new Date(),
      };

      const basePath = `sessions.${sessionIndex}`;

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $push: { [`${basePath}.media`]: mediaItem } },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Upload media for a booking (booking-level, not session-level)
  async uploadBookingMedia(
    bookingId: ObjectId,
    file: Express.Multer.File,
    body: GroomingMediaDto,
    user?: { _id: ObjectId; username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      const uploadResult = await uploadToCloudinary(
        base64Image,
        generateGroomingSessionFolder(booking.pet_snapshot.name, body.type),
      );

      const mediaItem = {
        type: body.type,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        created_by: {
          user_id: user?._id,
          name_snapshot: user?.username,
        },
        note: body.note || '',
        uploaded_at: new Date(),
      };

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $push: { media: mediaItem } },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Delete a specific media item from a booking (matched by public_id)
  async deleteBookingMedia(bookingId: ObjectId, publicId: string) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $pull: { media: { public_id: publicId } } },
        { new: true },
      );

      if (!updatedBooking) {
        throw new NotFoundException('Booking not found');
      }

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Upload "other" media from a specific session — stored in booking.media[]
  // Only admin or the groomer assigned to the session can upload
  async uploadSessionOtherMedia(
    bookingId: ObjectId,
    sessionId: ObjectId,
    file: Express.Multer.File,
    note: string | undefined,
    user?: { _id: ObjectId; username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      const session = booking.sessions.find(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // Authorization: admin can upload for any session;
      // groomer can only upload for sessions assigned to them
      if (user?.role !== 'admin') {
        const sessionGroomerId = (session as any).groomer_id?.toString();
        const requestUserId = user?._id?.toString();
        if (!sessionGroomerId || sessionGroomerId !== requestUserId) {
          throw new ForbiddenException(
            'Hanya admin atau groomer yang mengerjakan sesi ini yang dapat mengupload foto',
          );
        }
      }

      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      const uploadResult = await uploadToCloudinary(
        base64Image,
        generateGroomingSessionFolder(
          booking.pet_snapshot.name,
          MediaType.OTHER,
        ),
      );

      const mediaItem = {
        type: MediaType.OTHER,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        session_id: sessionId.toString(),
        created_by: {
          user_id: user?._id,
          name_snapshot: user?.username,
        },
        note: note || '',
        uploaded_at: new Date(),
      };

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $push: { media: mediaItem } },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  // Delete booking media with auth check:
  // admin can delete any media; groomer can only delete media they uploaded
  async deleteBookingMediaWithAuth(
    bookingId: ObjectId,
    publicId: string,
    user?: { _id: ObjectId; username: string; role: string },
  ) {
    try {
      const booking = await this.findBookingOrFail(bookingId);
      this.assertNotReturned(booking);

      if (user?.role !== 'admin') {
        const mediaItem = booking.media?.find(
          (m: any) => m.public_id === publicId,
        );
        if (!mediaItem) {
          throw new NotFoundException('Media not found');
        }
        const creatorId = (mediaItem as any).created_by?.user_id?.toString();
        if (creatorId !== user?._id?.toString()) {
          throw new ForbiddenException(
            'Hanya admin atau pengunggah asli yang dapat menghapus foto ini',
          );
        }
      }

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        { $pull: { media: { public_id: publicId } } },
        { new: true },
      );

      if (!updatedBooking) {
        throw new NotFoundException('Booking not found');
      }

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }
}
