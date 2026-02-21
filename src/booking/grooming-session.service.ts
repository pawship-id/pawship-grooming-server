import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Booking, BookingDocument } from './entities/booking.entity';
import { BookingStatus, SessionStatus, MediaType } from './dto/booking.dto';
import {
  generateGroomingSessionFolder,
  uploadToCloudinary,
} from 'src/helpers/cloudinary';
import { GroomingMediaDto } from './dto/grooming-media.dto';
import { UpdateSessionDto } from './dto/update-grooming-session.dto';

@Injectable()
export class GroomingSessionService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  // ==================== SESSION MANAGEMENT ====================
  // Sessions are auto-created when groomers are assigned via assignGroomer in booking.service.ts
  // These methods handle updating, deleting, and workflow actions on existing sessions

  // Update an existing session by ID
  async updateSession(
    bookingId: ObjectId,
    sessionId: ObjectId,
    dto: UpdateSessionDto,
  ) {
    try {
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking || booking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

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
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking || booking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

      // Find the session to get the groomer_id and type
      const session = booking.sessions.find(
        (s: any) => s._id.toString() === sessionId.toString(),
      );

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // Remove the session and the corresponding assigned groomer
      // Match both groomer_id and task since one groomer can handle multiple tasks
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $pull: {
            sessions: { _id: sessionId },
            assigned_groomers: {
              groomer_id: session.groomer_id,
              task: session.type,
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
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking || booking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

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
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking || booking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

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
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking || booking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

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
}
