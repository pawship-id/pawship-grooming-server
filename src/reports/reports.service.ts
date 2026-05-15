import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable, Subscriber } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageDocument,
} from 'src/booking/entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import { FinancialReportDto } from './dto/financial-report.dto';
import { OperationsReportDto } from './dto/operations-report.dto';
import { CapacityUtilisationReportDto } from './dto/capacity-utilisation-report.dto';
import { BookingEventsService } from 'src/booking-events/booking-events.service';

const STREAM_CHUNK_SIZE = 50;

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(StoreDailyUsage.name)
    private readonly storeDailyUsageModel: Model<StoreDailyUsageDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    private readonly bookingEventsService: BookingEventsService,
  ) {}

  private buildFilter(dto: FinancialReportDto): Record<string, any> {
    const filter: Record<string, any> = { isDeleted: false };

    if (dto.booking_status) filter.booking_status = dto.booking_status;

    if (dto.date_from || dto.date_to) {
      filter.date = {};
      if (dto.date_from) filter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) filter.date.$lte = new Date(dto.date_to);
    }

    if (dto.store_id) {
      try {
        const oid = new Types.ObjectId(dto.store_id);
        filter.store_id = { $in: [oid, dto.store_id] };
      } catch {
        filter.store_id = dto.store_id;
      }
    }

    if (dto.booking_type) filter.type = dto.booking_type;

    return filter;
  }

  async getFinancialReport(dto: FinancialReportDto) {
    const filter = this.buildFilter(dto);
    const limit = Math.min(dto.limit ?? 10000, 50000);

    const bookings = await this.bookingModel
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('customer', 'code username email phone_number')
      .populate('store', 'code name')
      .populate('pet', 'code')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username',
        model: 'User',
      })
      .exec();

    const plain = bookings.map((b) =>
      (b as any).toJSON ? (b as any).toJSON() : b,
    );

    return { bookings: plain, total: plain.length };
  }

  streamFinancialReport(dto: FinancialReportDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;

      this.getFinancialReport(dto)
        .then(async ({ bookings }) => {
          for (let i = 0; i < bookings.length; i += STREAM_CHUNK_SIZE) {
            if (cancelled) break;
            subscriber.next({
              data: JSON.stringify({ bookings: bookings.slice(i, i + STREAM_CHUNK_SIZE) }),
              type: 'chunk',
            } as MessageEvent);
            await new Promise<void>((resolve) => setImmediate(resolve));
          }
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ total: bookings.length }),
              type: 'done',
            } as MessageEvent);
            subscriber.complete();
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ message: err.message }),
              type: 'error',
            } as MessageEvent);
            subscriber.error(err);
          }
        });

      return () => {
        cancelled = true;
      };
    });
  }

  // ─── Operations: Booking & Ops Detail ────────────────────────────────────────

  private buildOperationsFilter(dto: OperationsReportDto): Record<string, any> {
    const filter: Record<string, any> = { isDeleted: false };

    if (dto.booking_status) filter.booking_status = dto.booking_status;

    if (dto.date_from || dto.date_to) {
      filter.date = {};
      if (dto.date_from) filter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) filter.date.$lte = new Date(dto.date_to);
    }

    if (dto.store_id) {
      try {
        const oid = new Types.ObjectId(dto.store_id);
        filter.store_id = { $in: [oid, dto.store_id] };
      } catch {
        filter.store_id = dto.store_id;
      }
    }

    if (dto.booking_type) filter.type = dto.booking_type;

    if (dto.session_status) filter['sessions.status'] = dto.session_status;

    if (dto.service_type) {
      filter['service_snapshot.service_type.title'] = {
        $regex: new RegExp(`^${dto.service_type}$`, 'i'),
      };
    }

    return filter;
  }

  async getOperationsReport(dto: OperationsReportDto) {
    const filter = this.buildOperationsFilter(dto);
    const limit = Math.min(dto.limit ?? 10000, 50000);

    const bookings = await this.bookingModel
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('customer', 'code username email phone_number')
      .populate('store', 'code name')
      .populate('pet', 'code')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username',
        model: 'User',
      })
      .exec();

    const plain = bookings.map((b) =>
      (b as any).toJSON ? (b as any).toJSON() : b,
    );

    return { bookings: plain, total: plain.length };
  }

  streamOperationsReport(dto: OperationsReportDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;

      this.getOperationsReport(dto)
        .then(async ({ bookings }) => {
          for (let i = 0; i < bookings.length; i += STREAM_CHUNK_SIZE) {
            if (cancelled) break;
            subscriber.next({
              data: JSON.stringify({ bookings: bookings.slice(i, i + STREAM_CHUNK_SIZE) }),
              type: 'chunk',
            } as MessageEvent);
            await new Promise<void>((resolve) => setImmediate(resolve));
          }
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ total: bookings.length }),
              type: 'done',
            } as MessageEvent);
            subscriber.complete();
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ message: err.message }),
              type: 'error',
            } as MessageEvent);
            subscriber.error(err);
          }
        });

      return () => {
        cancelled = true;
      };
    });
  }

  // ─── Capacity Utilisation Report ─────────────────────────────────────────────

  async getCapacityUtilisationReport(dto: CapacityUtilisationReportDto) {
    // 1. Build usage filter
    const usageFilter: Record<string, any> = {};
    if (dto.store_id) {
      try {
        usageFilter.store_id = new Types.ObjectId(dto.store_id);
      } catch {
        usageFilter.store_id = dto.store_id;
      }
    }
    if (dto.date_from || dto.date_to) {
      usageFilter.date = {};
      if (dto.date_from) usageFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        // Include the full end date
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        usageFilter.date.$lte = end;
      }
    }

    // 2. Fetch StoreDailyUsage records sorted newest first
    const usages = await this.storeDailyUsageModel
      .find(usageFilter)
      .sort({ date: -1, store_id: 1 })
      .exec();

    if (usages.length === 0) return { count: 0, data: [] };

    // 3. Collect unique store IDs
    const storeObjectIds = [
      ...new Set(usages.map((u) => u.store_id.toString())),
    ].map((id) => new Types.ObjectId(id));

    // 4. Fetch stores in a single query
    const stores = await this.storeModel
      .find({ _id: { $in: storeObjectIds } })
      .select('code name capacity')
      .exec();

    const storeMap = new Map(
      stores.map((s) => [s._id.toString(), s]),
    );

    // 5. Fetch all capacity overrides for the covered date range
    const capFilter: Record<string, any> = {
      store_id: { $in: storeObjectIds },
    };
    if (dto.date_from || dto.date_to) {
      capFilter.date = {};
      if (dto.date_from) capFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        capFilter.date.$lte = end;
      }
    }

    const capacities = await this.storeDailyCapacityModel
      .find(capFilter)
      .exec();

    // Key: `storeId-YYYY-MM-DD`
    const capMap = new Map(
      capacities.map((c) => [
        `${c.store_id.toString()}-${c.date.toISOString().slice(0, 10)}`,
        c,
      ]),
    );

    // 6. Count bookings per store+date via aggregation
    const bookingFilter: Record<string, any> = { isDeleted: false };
    if (dto.store_id) {
      try {
        bookingFilter.store_id = new Types.ObjectId(dto.store_id);
      } catch {
        bookingFilter.store_id = dto.store_id;
      }
    }
    if (dto.date_from || dto.date_to) {
      bookingFilter.date = {};
      if (dto.date_from) bookingFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        bookingFilter.date.$lte = end;
      }
    }

    const bookingCounts: { _id: { store_id: Types.ObjectId; date: string }; count: number }[] =
      await this.bookingModel.aggregate([
        { $match: bookingFilter },
        {
          $group: {
            _id: {
              store_id: '$store_id',
              date: {
                $dateToString: { format: '%Y-%m-%d', date: '$date' },
              },
            },
            count: { $sum: 1 },
          },
        },
      ]);

    const bookingCountMap = new Map(
      bookingCounts.map((b) => [
        `${b._id.store_id.toString()}-${b._id.date}`,
        b.count,
      ]),
    );

    // 7. Build enriched rows
    const data = usages.map((u) => {
      const storeId = u.store_id.toString();
      const dateStr = u.date.toISOString().slice(0, 10);
      const store = storeMap.get(storeId);

      const defaultCap =
        store?.capacity?.default_daily_capacity_minutes ?? 960;
      const overbookingLimit =
        store?.capacity?.overbooking_limit_minutes ?? 120;

      const capOverride = capMap.get(`${storeId}-${dateStr}`);
      const hasOverride = !!capOverride;
      const effectiveCap = hasOverride
        ? capOverride!.total_capacity_minutes
        : defaultCap;

      const usedMins = u.used_minutes;
      const utilisationPct =
        effectiveCap > 0
          ? Math.round((usedMins / effectiveCap) * 10000) / 100
          : 0;
      const remainingMins = Math.max(0, effectiveCap - usedMins);
      const isOverbooked = usedMins > effectiveCap;

      return {
        store_id: storeId,
        store_code: store?.code ?? '',
        store_name: store?.name ?? '',
        date: dateStr,
        default_capacity_mins: defaultCap,
        daily_override_mins: hasOverride
          ? capOverride!.total_capacity_minutes
          : null,
        effective_capacity_mins: effectiveCap,
        used_minutes: usedMins,
        utilisation_pct: utilisationPct,
        remaining_minutes: remainingMins,
        total_bookings: bookingCountMap.get(`${storeId}-${dateStr}`) ?? 0,
        overbooking_limit_mins: overbookingLimit,
        is_overbooked: isOverbooked,
        has_capacity_override: hasOverride,
        capacity_notes: capOverride?.notes ?? null,
      };
    });

    return { count: data.length, data };
  }

  // ─── Capacity Utilisation SSE stream ─────────────────────────────────────────

  private async getCapacityRowForStoreDate(storeId: string, dateStr: string) {
    const storeOid = new Types.ObjectId(storeId);
    const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const [usage, store, capOverride, totalBookings] = await Promise.all([
      this.storeDailyUsageModel
        .findOne({ store_id: storeOid, date: { $gte: dateStart, $lte: dateEnd } })
        .exec(),
      this.storeModel.findById(storeOid).select('code name capacity').exec(),
      this.storeDailyCapacityModel
        .findOne({ store_id: storeOid, date: { $gte: dateStart, $lte: dateEnd } })
        .exec(),
      this.bookingModel.countDocuments({
        store_id: storeOid,
        date: { $gte: dateStart, $lte: dateEnd },
        isDeleted: false,
      }),
    ]);

    if (!usage) return null;

    const defaultCap = store?.capacity?.default_daily_capacity_minutes ?? 960;
    const overbookingLimit = store?.capacity?.overbooking_limit_minutes ?? 120;
    const hasOverride = !!capOverride;
    const effectiveCap = hasOverride ? capOverride!.total_capacity_minutes : defaultCap;
    const usedMins = usage.used_minutes;
    const utilisationPct =
      effectiveCap > 0 ? Math.round((usedMins / effectiveCap) * 10000) / 100 : 0;

    return {
      store_id: storeId,
      store_code: store?.code ?? '',
      store_name: store?.name ?? '',
      date: dateStr,
      default_capacity_mins: defaultCap,
      daily_override_mins: hasOverride ? capOverride!.total_capacity_minutes : null,
      effective_capacity_mins: effectiveCap,
      used_minutes: usedMins,
      utilisation_pct: utilisationPct,
      remaining_minutes: Math.max(0, effectiveCap - usedMins),
      total_bookings: totalBookings,
      overbooking_limit_mins: overbookingLimit,
      is_overbooked: usedMins > effectiveCap,
      has_capacity_override: hasOverride,
      capacity_notes: capOverride?.notes ?? null,
    };
  }

  streamCapacityUtilisationReport(
    dto: CapacityUtilisationReportDto,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;

      // Send initial snapshot
      this.getCapacityUtilisationReport(dto)
        .then(({ data }) => {
          if (cancelled) return;
          subscriber.next({
            data: JSON.stringify({ rows: data }),
            type: 'snapshot',
          } as MessageEvent);
        })
        .catch((err: Error) => {
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ message: err.message }),
              type: 'error',
            } as MessageEvent);
            subscriber.error(err);
          }
        });

      // Subscribe to live booking mutations
      const sub = this.bookingEventsService.bookingMutated$.subscribe(
        async (bookingId: string) => {
          if (cancelled) return;
          try {
            const booking = await this.bookingModel
              .findById(new Types.ObjectId(bookingId))
              .select('store_id date')
              .exec();

            if (!booking) return;

            const storeId = (booking.store_id as Types.ObjectId).toString();
            const dateStr = (booking.date as Date).toISOString().slice(0, 10);

            // Only push updates that fall within the active filter
            if (dto.store_id) {
              try {
                if (new Types.ObjectId(dto.store_id).toString() !== storeId) return;
              } catch {
                if (dto.store_id !== storeId) return;
              }
            }
            if (dto.date_from && dateStr < dto.date_from) return;
            if (dto.date_to && dateStr > dto.date_to) return;

            // Small delay so StoreDailyUsage is committed before we re-query
            await new Promise<void>((resolve) => setTimeout(resolve, 300));
            if (cancelled) return;

            const row = await this.getCapacityRowForStoreDate(storeId, dateStr);
            if (row && !cancelled) {
              subscriber.next({
                data: JSON.stringify({ row }),
                type: 'update',
              } as MessageEvent);
            }
          } catch {
            // non-fatal
          }
        },
      );

      return () => {
        cancelled = true;
        sub.unsubscribe();
      };
    });
  }

  streamLiveBookings(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      const sub = this.bookingEventsService.bookingMutated$.subscribe(
        async (bookingId: string) => {
          try {
            const booking = await this.bookingModel
              .findById(new Types.ObjectId(bookingId))
              .populate('customer', 'code username email phone_number')
              .populate('store', 'code name')
              .populate('pet', 'code')
              .populate({ path: 'sessions.groomer_id', select: 'username', model: 'User' })
              .exec();

            if (!booking || (booking as any).isDeleted) return;

            const plain = (booking as any).toJSON
              ? (booking as any).toJSON()
              : booking;

            subscriber.next({
              data: JSON.stringify({ booking: plain }),
              type: 'booking_changed',
            } as MessageEvent);
          } catch {
            // non-fatal — skip failed lookup
          }
        },
      );

      return () => sub.unsubscribe();
    });
  }
}
