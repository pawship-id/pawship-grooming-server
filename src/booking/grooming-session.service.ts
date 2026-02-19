import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Booking, BookingDocument } from './entities/booking.entity';
import {
  BookingStatus,
  GroomingSessionStatus,
  MediaType,
} from './dto/booking.dto';
import {
  generateGroomingSessionFolder,
  uploadToCloudinary,
} from 'src/helpers/cloudinary';
import { GroomingMediaDto } from './dto/grooming-media.dto';

@Injectable()
export class GroomingSessionService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async arriveGroomer(bookingId: ObjectId) {
    try {
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            booking_status: BookingStatus.ARRIVED,
            'grooming_session.arrived_at': new Date(),
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

  async startGrooming(bookingId: ObjectId) {
    try {
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            booking_status: BookingStatus.GROOMING_IN_PROGRESS,
            'grooming_session.status': GroomingSessionStatus.IN_PROGRESS,
            'grooming_session.started_at': new Date(),
          },
          $push: {
            status_logs: {
              status: BookingStatus.GROOMING_IN_PROGRESS,
              timestamp: new Date(),
              note: `Status changed to ${BookingStatus.GROOMING_IN_PROGRESS} by the groomer`,
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

  async finishGrooming(bookingId: ObjectId) {
    try {
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            booking_status: BookingStatus.GROOMING_FINISHED,
            'grooming_session.status': GroomingSessionStatus.FINISHED,
            'grooming_session.finished_at': new Date(),
          },
          $push: {
            status_logs: {
              status: BookingStatus.GROOMING_FINISHED,
              timestamp: new Date(),
              note: `Status changed to ${BookingStatus.GROOMING_FINISHED} by the groomer`,
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

  async uploadMedia(
    bookingId: ObjectId,
    file: Express.Multer.File,
    body: GroomingMediaDto,
  ) {
    try {
      const booking = await this.bookingModel.findById(bookingId);

      if (!booking || booking.isDeleted) {
        throw new NotFoundException('data not found');
      }

      // konversi buffer ke base64 untuk Cloudinary
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // unggah ke Cloudinary
      const uploadResult = await uploadToCloudinary(
        base64Image,
        generateGroomingSessionFolder(booking.pet_snapshot.name, body.type),
      );

      // membuat objek media
      const mediaItem = {
        type: body.type,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        created_by: {
          user_id: body.user_id,
          name_snapshot: body.user_name,
        },
        note: body.note || '-',
      };

      // tambahkan media ke array grooming_session.media
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          $push: {
            'grooming_session.media': mediaItem,
          },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }
}
