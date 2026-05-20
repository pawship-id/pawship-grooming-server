import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { parseRange, previousRange } from '../utils/date-range';

export interface BookingsKpis {
  total_bookings: number;
  new_pets: number;
  returning_pets: number;
  cancellation_rate_pct: number;
  reschedule_rate_pct: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  delta: {
    total_bookings_pct: number | null;
    new_pets_pct: number | null;
    returning_pets_pct: number | null;
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
  serviceType?: string;
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
    const storeMatch = {
      ...buildStoreMatch(args.storeId),
      ...buildServiceTypeMatch(args.serviceType),
    };

    const [
      current,
      previous,
      byStatus,
      byServiceType,
      peakHour,
      byDay,
      reschedule,
    ] = await Promise.all([
      this.aggregateKpis(range, storeMatch),
      this.aggregateKpis(prevRange, storeMatch),
      this.aggregateByStatus(range, storeMatch),
      this.aggregateByServiceType(range, storeMatch),
      this.aggregatePeakHour(range, storeMatch),
      this.aggregateByDay(range, storeMatch),
      this.aggregateRescheduleMetrics(range, storeMatch),
    ]);

    const cancellationRate =
      current.total > 0
        ? round2((current.cancelled / current.total) * 100)
        : 0;
    const rescheduleRate =
      reschedule.adjustedTotal > 0
        ? round2((reschedule.rescheduled / reschedule.adjustedTotal) * 100)
        : 0;

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      kpis: {
        total_bookings: current.total,
        new_pets: current.newPets,
        returning_pets: current.returningPets,
        cancellation_rate_pct: cancellationRate,
        reschedule_rate_pct: rescheduleRate,
        completed: current.completed,
        cancelled: current.cancelled,
        rescheduled: reschedule.rescheduled,
        delta: {
          total_bookings_pct: pctDelta(current.total, previous.total),
          new_pets_pct: pctDelta(current.newPets, previous.newPets),
          returning_pets_pct: pctDelta(
            current.returningPets,
            previous.returningPets,
          ),
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
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
                $cond: [
                  { $in: ['$booking_status', ['completed', 'returned']] },
                  1,
                  0,
                ],
              },
            },
            cancelled: {
              $sum: {
                $cond: [{ $eq: ['$booking_status', 'cancelled'] }, 1, 0],
              },
            },
            rescheduled: {
              $sum: {
                $cond: [{ $eq: ['$booking_status', 'rescheduled'] }, 1, 0],
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
            date: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: '$pet_id',
            completed_count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            new_pets: {
              $sum: { $cond: [{ $eq: ['$completed_count', 1] }, 1, 0] },
            },
            returning_pets: {
              $sum: { $cond: [{ $gt: ['$completed_count', 1] }, 1, 0] },
            },
          },
        },
      ])
      .exec();

    return {
      total: counts?.total ?? 0,
      completed: counts?.completed ?? 0,
      cancelled: counts?.cancelled ?? 0,
      rescheduled: counts?.rescheduled ?? 0,
      newPets: newPetsRow?.new_pets ?? 0,
      returningPets: newPetsRow?.returning_pets ?? 0,
    };
  }

  /**
   * Hitung kartu Reschedule berdasarkan previous_date di status_logs.
   *
   * - `rescheduled`: jumlah booking (dedup) yang originalnya dijadwalkan di
   *   periode filter (previous_date di range) DAN setelah reschedule sudah
   *   tidak berada di periode tersebut (current date di luar range). Booking
   *   yang dipindahkan ke tanggal lain tapi tetap di dalam periode (intra-range
   *   move) tidak dihitung.
   *
   * - `adjustedTotal`: pembagi untuk rate. Booking dianggap "milik periode ini"
   *   jika date saat ini di range ATAU pernah punya previous_date di range
   *   (union, dedup). Sehingga reschedule_rate_pct tetap semantik konsisten
   *   meski booking sudah pindah keluar dari periode.
   */
  private async aggregateRescheduleMetrics(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<{ rescheduled: number; adjustedTotal: number }> {
    const previousDateInRange = {
      status_logs: {
        $elemMatch: {
          status: 'rescheduled',
          previous_date: { $gte: range.from, $lte: range.to },
        },
      },
    };

    const dateOutsideRange = {
      $or: [
        { date: { $lt: range.from } },
        { date: { $gt: range.to } },
      ],
    };

    const [row] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            isDeleted: { $ne: true },
            $or: [
              { date: { $gte: range.from, $lte: range.to } },
              previousDateInRange,
            ],
          },
        },
        {
          $facet: {
            adjusted_total: [{ $count: 'count' }],
            rescheduled: [
              {
                $match: {
                  ...previousDateInRange,
                  ...dateOutsideRange,
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ])
      .exec();

    return {
      rescheduled: row?.rescheduled?.[0]?.count ?? 0,
      adjustedTotal: row?.adjusted_total?.[0]?.count ?? 0,
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

function buildServiceTypeMatch(
  serviceType?: string,
): Record<string, any> {
  if (!serviceType || serviceType === 'all') return {};
  // Match the snapshot title — same field the by_service_type breakdown
  // groups on, so the filtered totals always line up with what the user
  // sees in that chart, even if a service-type was later renamed.
  return { 'service_snapshot.service_type.title': serviceType };
}

function parseStartHour(timeRange: unknown): number | null {
  if (typeof timeRange !== 'string') return null;
  // Sessions disimpan dengan '.' sebagai pemisah (mis. "09.00 - 12.00"),
  // tapi input form awal & beberapa data lama bisa pakai ':'. Terima keduanya.
  const match = /^(\d{1,2})[.:]/.exec(timeRange.trim());
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
