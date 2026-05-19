import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { parseRange, previousRange } from '../utils/date-range';
import {
  EFFECTIVE_COMPLETED_AT_FIELD,
  completedAtRangeMatch,
  withEffectiveCompletedAt,
} from '../utils/completed-at';

export interface BookingsKpis {
  total_bookings: number;
  new_pets_served: number;
  returning_pets: number;
  repeat_booking_rate_pct: number;
  cancellation_rate_pct: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  delta: {
    total_bookings_pct: number | null;
    new_pets_served_pct: number | null;
  };
}

export interface BookingStatusBreakdown {
  status: string;
  count: number;
}

export interface BookingServiceBreakdown {
  service_type: string;
  count: number;
}

export interface PeakHourBucket {
  hour: number; // 0..23
  count: number;
}

export interface BookingsByDayBucket {
  day_index: number; // 0=Mon..6=Sun
  label: string;
  count: number;
}

export interface BookingsResponse {
  range: { from: string; to: string };
  kpis: BookingsKpis;
  by_status: BookingStatusBreakdown[];
  by_service_type: BookingServiceBreakdown[];
  peak_hour: PeakHourBucket[];
  by_day: BookingsByDayBucket[];
}

interface BookingsQueryArgs {
  storeId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class BookingsMetricsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async getBookings(args: BookingsQueryArgs): Promise<BookingsResponse> {
    const range = parseRange(args.from, args.to);
    const prevRange = previousRange(range);
    const storeMatch = buildStoreMatch(args.storeId);

    const [current, previous, byStatus, byServiceType, peakHour, byDay] =
      await Promise.all([
        this.aggregateKpis(range, storeMatch),
        this.aggregateKpis(prevRange, storeMatch),
        this.aggregateByStatus(range, storeMatch),
        this.aggregateByServiceType(range, storeMatch),
        this.aggregatePeakHour(range, storeMatch),
        this.aggregateByDay(range, storeMatch),
      ]);

    const repeatDenom = current.newPets + current.returningPets;
    const repeatRate =
      repeatDenom > 0
        ? round2((current.returningPets / repeatDenom) * 100)
        : 0;

    const cancellationRate =
      current.total > 0
        ? round2((current.cancelled / current.total) * 100)
        : 0;

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      kpis: {
        total_bookings: current.total,
        new_pets_served: current.newPets,
        returning_pets: current.returningPets,
        repeat_booking_rate_pct: repeatRate,
        cancellation_rate_pct: cancellationRate,
        completed: current.completed,
        cancelled: current.cancelled,
        no_shows: 0, // Schema tidak punya BookingStatus.no_show — placeholder per spek
        delta: {
          total_bookings_pct: pctDelta(current.total, previous.total),
          new_pets_served_pct: pctDelta(current.newPets, previous.newPets),
        },
      },
      by_status: byStatus,
      by_service_type: byServiceType,
      peak_hour: peakHour,
      by_day: byDay,
    };
  }

  private async aggregatePeakHour(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<PeakHourBucket[]> {
    const rows = await this.bookingModel
      .find({
        ...storeMatch,
        date: { $gte: range.from, $lte: range.to },
        isDeleted: { $ne: true },
      })
      .select('time_range')
      .lean<any[]>()
      .exec();

    const counts = new Map<number, number>();
    for (const r of rows) {
      const hour = parseStartHour(r.time_range);
      if (hour === null) continue;
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }

  private async aggregateByDay(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<BookingsByDayBucket[]> {
    // $dayOfWeek: 1=Sunday..7=Saturday → remap to 0=Mon..6=Sun
    const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            date: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: { $dayOfWeek: '$date' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const byIdx = new Map<number, number>();
    for (const r of rows) {
      const dow = Number(r._id);
      const idx = ((dow + 5) % 7); // 1(Sun)→6, 2(Mon)→0, ...7(Sat)→5
      byIdx.set(idx, r.count ?? 0);
    }

    return labels.map((label, idx) => ({
      day_index: idx,
      label,
      count: byIdx.get(idx) ?? 0,
    }));
  }

  private async aggregateKpis(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ) {
    const [counts] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            date: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$booking_status', 'completed'] }, 1, 0],
              },
            },
            cancelled: {
              $sum: {
                $cond: [{ $eq: ['$booking_status', 'cancelled'] }, 1, 0],
              },
            },
          },
        },
      ])
      .exec();

    const [newPetsRow] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: 'completed',
            isDeleted: { $ne: true },
          },
        },
        withEffectiveCompletedAt(),
        { $match: completedAtRangeMatch(range.from, range.to) },
        {
          $lookup: {
            from: 'bookings',
            let: {
              petId: '$pet_id',
              completedAt: `$${EFFECTIVE_COMPLETED_AT_FIELD}`,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $eq: ['$booking_status', 'completed'] },
                      { $ne: ['$isDeleted', true] },
                    ],
                  },
                },
              },
              withEffectiveCompletedAt(),
              {
                $match: {
                  $expr: {
                    $lt: [`$${EFFECTIVE_COMPLETED_AT_FIELD}`, '$$completedAt'],
                  },
                },
              },
              { $limit: 1 },
              { $count: 'prior' },
            ],
            as: 'prior_completed',
          },
        },
        {
          $addFields: {
            prior_count: {
              $ifNull: [{ $arrayElemAt: ['$prior_completed.prior', 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: null,
            new_pets: {
              $sum: { $cond: [{ $eq: ['$prior_count', 0] }, 1, 0] },
            },
            returning_pets: {
              $sum: { $cond: [{ $gt: ['$prior_count', 0] }, 1, 0] },
            },
          },
        },
      ])
      .exec();

    return {
      total: counts?.total ?? 0,
      completed: counts?.completed ?? 0,
      cancelled: counts?.cancelled ?? 0,
      newPets: newPetsRow?.new_pets ?? 0,
      returningPets: newPetsRow?.returning_pets ?? 0,
    };
  }

  private async aggregateByStatus(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<BookingStatusBreakdown[]> {
    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            date: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: '$booking_status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .exec();

    return rows.map((r) => ({
      status: String(r._id ?? 'unknown'),
      count: r.count ?? 0,
    }));
  }

  private async aggregateByServiceType(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<BookingServiceBreakdown[]> {
    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            date: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [
                '$service_snapshot.service_type.title',
                'Tidak diketahui',
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();

    return rows.map((r) => ({
      service_type: String(r._id),
      count: r.count ?? 0,
    }));
  }
}

function buildStoreMatch(storeId?: string): Record<string, any> {
  if (!storeId || storeId === 'all') return {};
  if (!Types.ObjectId.isValid(storeId)) return {};
  return { store_id: new Types.ObjectId(storeId) };
}

function parseStartHour(timeRange: unknown): number | null {
  if (typeof timeRange !== 'string') return null;
  const match = /^(\d{1,2}):/.exec(timeRange.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) {
    return current > 0 ? 100 : null;
  }
  return round2(((current - previous) / previous) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
