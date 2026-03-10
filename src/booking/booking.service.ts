import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatusLogDto,
  CreateBookingDto,
} from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './entities/booking.entity';
import { Model, Types, Connection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { PetService } from 'src/pet/pet.service';
import { ServiceService } from 'src/service/service.service';
import { BookingStatus, GroomingType, SessionStatus } from './dto/booking.dto';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import { Service, ServiceDocument } from 'src/service/entities/service.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageDocument,
} from './entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(StoreDailyUsage.name)
    private readonly storeDailyUsageModel: Model<StoreDailyUsageDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly petService: PetService,
    private readonly serviceService: ServiceService,
  ) {}

  async create(
    body: CreateBookingDto,
    user?: { username: string; role: string },
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Get pet snapshot
      const pet = await this.petService.getPetSnapshot(
        new ObjectId(body.pet_id),
      );

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
      };

      body.service_snapshot = (await this.serviceService.getServiceSnapshot(
        new ObjectId(body.service_id),
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
        body.service_addon_ids?.map((id) => new ObjectId(id)),
      )) as any;

      // 1️⃣ Ambil Store dengan session
      const store = await this.storeModel
        .findById(body.store_id)
        .session(session);

      if (!store) throw new NotFoundException('Store not found');

      // 2️⃣ Ambil Service dan Addons
      // Handle service price calculation
      const service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
      );

      // Handle add-ons jika ada
      let addonsTotal = 0;
      let addonsTotalDuration = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );

        addonsTotalDuration = addons.reduce(
          (total, addon) => total + (addon.duration || 0),
          0,
        );
      }

      const serviceDuration =
        (Number(service.duration) || 0) + addonsTotalDuration;
      body.sub_total_service = service.price + addonsTotal;
      body.total_price = (body.sub_total_service || 0) + (body.travel_fee || 0);

      // assign body.type base on service.service_location_type
      body.type = service.service_location_type as GroomingType;

      // Handle sessions — admin can provide sessions[], guest/customer gets []
      if (
        user &&
        user.role !== 'customer' &&
        body.sessions &&
        body.sessions.length > 0
      ) {
        (body as any).sessions = body.sessions.map((s, index) => ({
          type: s.type,
          groomer_id: new Types.ObjectId(s.groomer_id),
          status: SessionStatus.NOT_STARTED,
          started_at: null,
          finished_at: null,
          notes: null,
          internal_note: null,
          order: s.order ?? index,
          media: [],
        }));
      } else {
        (body as any).sessions = [];
      }

      // 3️⃣ Ambil Capacity (override atau default)
      const dailyOverride = await this.storeDailyCapacityModel
        .findOne({
          store_id: new ObjectId(body.store_id),
          date: new Date(body.date),
        })
        .session(session);

      const totalCapacity =
        dailyOverride?.total_capacity_minutes ??
        store.capacity.default_daily_capacity_minutes;

      const overbookingLimit = store.capacity.overbooking_limit_minutes;
      const maxAllowedCapacity = totalCapacity + overbookingLimit;

      // 4️⃣ Atomic increment usage
      const usage = await this.storeDailyUsageModel.findOneAndUpdate(
        {
          store_id: new ObjectId(body.store_id),
          date: body.date,
        },
        {
          $inc: { used_minutes: serviceDuration },
        },
        {
          returnDocument: 'after',
          upsert: true,
          session,
        },
      );

      // 5️⃣ Validasi Overbooking Limit
      if (usage.used_minutes > maxAllowedCapacity) {
        // Rollback increment
        await this.storeDailyUsageModel.findOneAndUpdate(
          {
            store_id: new ObjectId(body.store_id),
            date: body.date,
          },
          {
            $inc: { used_minutes: -serviceDuration },
          },
          { session },
        );

        // Create status log for WAITLIST
        const waitlistStatusLog: BookingStatusLogDto = {
          status: BookingStatus.REQUESTED,
          timestamp: new Date(),
          note: `Booking is waitlisted (capacity exceeded) - created by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
        };

        body.status_logs = [waitlistStatusLog];
        body.booking_status = BookingStatus.REQUESTED;

        const waitlistBooking = await this.bookingModel.create([body], {
          session,
        });

        await session.commitTransaction();
        session.endSession();

        return waitlistBooking[0];
      }

      // 6️⃣ Hitung overbooked_minutes
      let overbookedMinutes = 0;

      if (usage.used_minutes > totalCapacity) {
        overbookedMinutes = usage.used_minutes - totalCapacity;
      }

      // 7️⃣ Create CONFIRMED Booking
      const statusLog: BookingStatusLogDto = {
        status: BookingStatus.REQUESTED,
        timestamp: new Date(),
        note: `Booking is created by ${user?.username || 'unknown'} (${user?.role || 'unknown'})${overbookedMinutes > 0 ? ` - overbooked by ${overbookedMinutes} minutes` : ''}`,
      };

      body.status_logs = [statusLog];

      const booking = await this.bookingModel.create([body], { session });

      await session.commitTransaction();
      session.endSession();

      return booking[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async findAll() {
    const bookings = await this.bookingModel
      .find({ isDeleted: false })
      .populate('customer', 'username email phone_number')
      .populate('store', 'name')
      .exec();

    return bookings;
  }

  async findOne(id: ObjectId) {
    const booking = await this.bookingModel
      .findById(id)
      .populate('customer', 'username email phone_number')
      .populate('store', 'name')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username email phone_number',
        model: 'User',
      })
      .exec();
    return booking;
  }

  async update(
    id: ObjectId,
    body: UpdateBookingDto,
    user?: { username: string; role: string },
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const existingBooking = await this.bookingModel
        .findById(id)
        .session(session);

      if (!existingBooking || existingBooking.isDeleted) {
        throw new NotFoundException('Booking not found');
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
          note: `Status changed to ${body.booking_status} by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
        };

        // tambahkan log baru ke log yang sudah ada.
        body.status_logs = [...status_logs, newStatusLog];
      }

      const pet = await this.petService.getPetSnapshot(
        new ObjectId(body.pet_id),
      );

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
      };

      body.service_snapshot = (await this.serviceService.getServiceSnapshot(
        new ObjectId(body.service_id),
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
        body.service_addon_ids?.map((id) => new ObjectId(id)),
      )) as any;

      // handle service
      const service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
      );

      // handle add-ons jika ada
      let addonsTotal = 0;
      let addonsTotalDuration = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );
        addonsTotalDuration = addons.reduce(
          (total, addon) => total + (addon.duration || 0),
          0,
        );
      }

      const newServiceDuration =
        (Number(service.duration) || 0) + addonsTotalDuration;

      body.sub_total_service = service.price + addonsTotal;
      body.total_price = (body.sub_total_service || 0) + (body.travel_fee || 0);

      // assign body.type base on service.service_location_type
      body.type = service.service_location_type as GroomingType;

      // Check if date or service/addons changed (affects capacity)
      const oldDate = new Date(existingBooking.date);

      // Use existing date if not provided in update
      const dateToUse = body.date || existingBooking.date;
      const newDate = new Date(dateToUse);

      const dateChanged = oldDate.getTime() !== newDate.getTime();

      // Get old service duration
      const oldService = await this.serviceModel
        .findById(existingBooking.service_id)
        .session(session);
      let oldServiceDuration = Number(oldService?.duration) || 0;

      if (
        existingBooking.service_addon_ids &&
        existingBooking.service_addon_ids.length > 0
      ) {
        const oldAddons = await this.serviceModel
          .find({
            _id: { $in: existingBooking.service_addon_ids },
          })
          .session(session);
        const oldAddonsDuration = oldAddons.reduce(
          (total, addon) => total + (Number(addon.duration) || 0),
          0,
        );
        oldServiceDuration += oldAddonsDuration;
      }

      const durationChanged = oldServiceDuration !== newServiceDuration;

      // If date or duration changed, update capacity tracking
      if (dateChanged || durationChanged) {
        // 1️⃣ Rollback old capacity usage
        await this.storeDailyUsageModel.findOneAndUpdate(
          {
            store_id: new ObjectId(existingBooking.store_id),
            date: oldDate,
          },
          {
            $inc: { used_minutes: -oldServiceDuration },
          },
          { session },
        );

        // 2️⃣ Get store and check new capacity
        const store = await this.storeModel
          .findById(body.store_id)
          .session(session);

        if (!store) throw new NotFoundException('Store not found');

        const dailyOverride = await this.storeDailyCapacityModel
          .findOne({
            store_id: new ObjectId(body.store_id),
            date: newDate,
          })
          .session(session);

        const totalCapacity =
          dailyOverride?.total_capacity_minutes ??
          store.capacity.default_daily_capacity_minutes;

        const overbookingLimit = store.capacity.overbooking_limit_minutes;
        const maxAllowedCapacity = totalCapacity + overbookingLimit;

        // 3️⃣ Atomic increment usage for new date
        const usage = await this.storeDailyUsageModel.findOneAndUpdate(
          {
            store_id: new ObjectId(body.store_id),
            date: newDate,
          },
          {
            $inc: { used_minutes: newServiceDuration },
          },
          {
            returnDocument: 'after',
            upsert: true,
            session,
          },
        );

        // 4️⃣ Validasi Overbooking Limit
        if (usage.used_minutes > maxAllowedCapacity) {
          // Rollback increment
          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(body.store_id),
              date: newDate,
            },
            {
              $inc: { used_minutes: -newServiceDuration },
            },
            { session },
          );

          // Restore old capacity usage
          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(existingBooking.store_id),
              date: oldDate,
            },
            {
              $inc: { used_minutes: oldServiceDuration },
            },
            { session },
          );

          await session.abortTransaction();
          session.endSession();

          throw new Error(
            `Cannot update booking: capacity exceeded for ${newDate.toISOString().split('T')[0]}. Available capacity: ${maxAllowedCapacity} minutes, would be used: ${usage.used_minutes} minutes.`,
          );
        }

        // 5️⃣ Update status log if overbooked
        let overbookedMinutes = 0;
        if (usage.used_minutes > totalCapacity) {
          overbookedMinutes = usage.used_minutes - totalCapacity;
        }

        if (overbookedMinutes > 0) {
          const overbookLog: BookingStatusLogDto = {
            status: existingBooking.booking_status,
            timestamp: new Date(),
            note: `Booking updated - overbooked by ${overbookedMinutes} minutes by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
          };
          body.status_logs = [...status_logs, overbookLog];
        }
      }

      // Prepare update data
      const updateData: any = { ...body };

      // Convert sessions[].groomer_id strings to ObjectId if sessions are provided
      if (body.sessions && body.sessions.length > 0) {
        updateData.sessions = body.sessions.map((s, index) => ({
          type: s.type,
          groomer_id: new Types.ObjectId(s.groomer_id),
          status: SessionStatus.NOT_STARTED,
          started_at: null,
          finished_at: null,
          notes: null,
          internal_note: null,
          order: s.order ?? index,
          media: [],
        }));
      }

      // update booking
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, session },
      );

      await session.commitTransaction();
      session.endSession();

      return updatedBooking;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
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

  async updateStatus(
    id: ObjectId,
    status: BookingStatus,
    note?: string,
    rescheduleData?: { date?: Date; time_range?: string },
    user?: { username: string; role: string },
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
        note:
          note ||
          `Status updated to ${status} by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
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
