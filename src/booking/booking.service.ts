import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatusLogDto,
  CreateBookingDto,
} from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './entities/booking.entity';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { PetService } from 'src/pet/pet.service';
import { ServiceService } from 'src/service/service.service';
import { BookingStatus, GroomingSessionStatus } from './dto/booking.dto';
import { CreateGroomingSessionDto } from './dto/create-grooming-session.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly petService: PetService,
    private readonly serviceService: ServiceService,
  ) {}

  async create(body: CreateBookingDto) {
    try {
      let pet = await this.petService.getPetSnapshot(new ObjectId(body.pet_id));

      body.pet_snapshot = {
        name: pet.name,
        member_type: pet.member_type,
      };

      // handle service
      let service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        new ObjectId(pet.size_category_id),
      );

      // handle add-ons jika ada
      let addonsTotal = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              new ObjectId(pet.size_category_id),
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );
      }

      body.sub_total_service = service.price + addonsTotal;

      // menghitung harga total
      body.total_price = (body.sub_total_service || 0) + (body.travel_fee || 0);

      const statusLog: BookingStatusLogDto = {
        status: BookingStatus.REQUESTED,
        timestamp: new Date(),
        note: 'Booking is created by the customer',
      };

      body.status_logs = [statusLog];

      const booking = new this.bookingModel(body);

      return await booking.save();
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    const bookings = await this.bookingModel
      .find({ isDeleted: false })
      .populate('customer', 'username email phone_number')
      .populate({
        path: 'pet',
        select: 'name size_category_id breed_category_id',
        populate: [
          {
            path: 'size',
            model: 'Option',
            select: '_id name',
          },
          {
            path: 'breed',
            model: 'Option',
            select: 'name',
          },
        ],
      })
      .populate('store', 'name')
      .populate('service', 'name prices')
      .populate('service_addons', 'name prices')
      .populate('groomers', 'username email phone_number')
      .exec();

    return bookings;
  }

  async findOne(id: ObjectId) {
    const booking = await this.bookingModel
      .findById(id)
      .populate('customer', 'username email phone_number')
      .populate({
        path: 'pet',
        select: 'name size_category_id breed_category_id',
        populate: [
          {
            path: 'size',
            model: 'Option',
            select: '_id name',
          },
          {
            path: 'breed',
            model: 'Option',
            select: 'name',
          },
        ],
      })
      .populate('store', 'name')
      .populate('service', 'name prices')
      .populate('service_addons', 'name prices')
      .populate('groomers', 'username email phone_number')
      .exec();
    return booking;
  }

  async update(id: ObjectId, body: UpdateBookingDto) {
    try {
      const existingBooking = await this.bookingModel.findById(id);

      if (!existingBooking || existingBooking.isDeleted) {
        throw new NotFoundException('booking not found');
      }

      // simpan dan status_logs yang lama
      const { status_logs } = existingBooking;

      // periksa apakah booking_status sedang diperbarui
      if (
        body.booking_status &&
        body.booking_status !== existingBooking.booking_status
      ) {
        // tambahkan entri log status baru
        const newStatusLog: BookingStatusLogDto = {
          status: body.booking_status,
          timestamp: new Date(),
          note: `Status changed to ${body.booking_status} by the admin`,
        };

        // tambahkan log baru ke log yang sudah ada.
        body.status_logs = [...status_logs, newStatusLog];
      }

      let pet = await this.petService.getPetSnapshot(new ObjectId(body.pet_id));

      body.pet_snapshot = {
        name: pet.name,
        member_type: pet.member_type,
      };

      // handle service
      let service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        new ObjectId(pet.size_category_id),
      );

      // handle add-ons jika ada
      let addonsTotal = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              new ObjectId(pet.size_category_id),
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );
      }

      body.sub_total_service = service.price + addonsTotal;

      // menghitung harga total
      body.total_price = (body.sub_total_service || 0) + (body.travel_fee || 0);

      // update booking
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  async remove(id: ObjectId) {
    const booking = await this.bookingModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return booking;
  }

  async assignGroomer(id: ObjectId, groomerIds: string[]) {
    try {
      const existingBooking = await this.findOne(id);

      if (!existingBooking || existingBooking.isDeleted) {
        throw new NotFoundException('data not found');
      }

      const updateData: any = {
        assigned_groomer_ids: groomerIds,
      };

      // jika belum pernah ada groomer yang di-assign, set status NOT_STARTED
      if (
        !existingBooking.assigned_groomer_ids ||
        existingBooking.assigned_groomer_ids.length === 0
      ) {
        const groomingSession: CreateGroomingSessionDto = {
          status: GroomingSessionStatus.NOT_STARTED,
        };

        updateData.grooming_session = groomingSession;
      }
      // kalau sudah ada groomer sebelumnya, grooming_session tetap seperti yang ada

      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(
    id: ObjectId,
    status: BookingStatus,
    note?: string,
    rescheduleData?: { date?: Date; time_range?: string },
  ) {
    try {
      // status yang diupdate dari API ini hanya untuk CONFIRMED, RESCHEDULED, CANCELLED

      // validasi: jika status RESCHEDULED, date dan time_range harus ada
      if (status === BookingStatus.RESCHEDULED) {
        if (!rescheduleData?.date || !rescheduleData?.time_range) {
          throw new NotFoundException(
            'date and time_range are required for rescheduled status',
          );
        }
      }

      // tambahkan log status baru
      const statusLog: BookingStatusLogDto = {
        status: status,
        timestamp: new Date(),
        note: note || `Status updated to ${status}`,
      };

      // prepare update data
      const updateData: any = {
        booking_status: status,
      };

      // jika RESCHEDULED, tambahkan date dan time_range ke update
      if (status === BookingStatus.RESCHEDULED && rescheduleData) {
        updateData.date = rescheduleData.date;
        updateData.time_range = rescheduleData.time_range;
      }

      // update booking status dan tambahkan ke status logs
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        {
          $set: updateData,
          $push: { status_logs: statusLog },
        },
        { new: true },
      );

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }
}
