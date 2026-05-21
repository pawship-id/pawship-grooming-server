import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { toUtcStartOfDay } from '../utils/date-range';
import {
  EFFECTIVE_COMPLETED_AT_FIELD,
  withEffectiveCompletedAt,
} from '../utils/completed-at';

export interface GroomerPerformanceItem {
  groomer_id: string;
  groomer_name: string;
  orders_completed: number;
  in_progress: number;
  avg_session_duration_min: number;
  avg_overrun_mins: number;
  workload_pct: number;
  on_time_rate_pct: number | null;
  revenue_attributed: number;
}

export interface GroomerPerformanceResponse {
  today: string;
  groomers: GroomerPerformanceItem[];
  team_on_time_rate_pct: number | null;
  team_avg_session_duration_min: number;
  team_revenue_attributed: number;
}

interface GroomerQueryArgs {
  storeId?: string;
}

const DEFAULT_SHIFT_MINUTES = 480; // 8 hours

@Injectable()
export class GroomerPerformanceService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getGroomerPerformance(
    args: GroomerQueryArgs,
  ): Promise<GroomerPerformanceResponse> {
    const today = toUtcStartOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const storeMatch: Record<string, any> = {};
    if (args.storeId && args.storeId !== 'all') {
      if (!Types.ObjectId.isValid(args.storeId)) {
        return {
          today: today.toISOString(),
          groomers: [],
          team_on_time_rate_pct: null,
          team_avg_session_duration_min: 0,
          team_revenue_attributed: 0,
        };
      }
      storeMatch.store_id = new Types.ObjectId(args.storeId);
    }

    const [sessionRows, revenueRows] = await Promise.all([
      this.aggregateSessionsToday(today, tomorrow, storeMatch),
      this.aggregateRevenueAttributionToday(today, tomorrow, storeMatch),
    ]);

    type SessionRow = {
      groomer_id: Types.ObjectId;
      status: string;
      started_at: Date | null;
      finished_at: Date | null;
      ideal_duration: number;
      service_duration: number;
    };

    const byGroomer = new Map<string, SessionRow[]>();
    for (const r of sessionRows as SessionRow[]) {
      const id = String(r.groomer_id);
      if (!byGroomer.has(id)) byGroomer.set(id, []);
      byGroomer.get(id)!.push(r);
    }

    const revenueByGroomer = new Map<string, number>();
    for (const r of revenueRows) {
      revenueByGroomer.set(String(r._id), r.revenue ?? 0);
    }

    // Union of groomer ids from both sources (some groomers may have only completed bookings, others only ongoing sessions today)
    const allIds = new Set<string>([
      ...byGroomer.keys(),
      ...revenueByGroomer.keys(),
    ]);

    const groomerIds = Array.from(allIds).map((id) => new Types.ObjectId(id));
    const groomerUsers = groomerIds.length
      ? await this.userModel
          .find({ _id: { $in: groomerIds } })
          .select('username profile.full_name')
          .lean<any[]>()
          .exec()
      : [];
    const nameById = new Map<string, string>();
    for (const u of groomerUsers) {
      nameById.set(
        String(u._id),
        u.profile?.full_name || u.username || 'Unknown',
      );
    }

    const items: GroomerPerformanceItem[] = [];
    let teamFinished = 0;
    let teamOnTime = 0;
    let teamTotalDuration = 0;
    let teamCountedSessions = 0;
    let teamRevenue = 0;

    for (const groomerId of allIds) {
      const sessions = byGroomer.get(groomerId) ?? [];
      let finished = 0;
      let inProgress = 0;
      let onTime = 0;
      let totalDuration = 0;
      let countedDurations = 0;
      let plannedMinutes = 0;
      let totalOverrun = 0;
      let overrunCount = 0;

      for (const s of sessions) {
        const planned =
          s.ideal_duration > 0
            ? s.ideal_duration
            : Math.round(
                (s.service_duration ?? 0) / Math.max(sessions.length, 1),
              );
        plannedMinutes += planned;

        if (s.status === 'in progress') inProgress += 1;
        if (s.status === 'finished' && s.started_at && s.finished_at) {
          finished += 1;
          const actual = Math.max(
            0,
            Math.round(
              (new Date(s.finished_at).getTime() -
                new Date(s.started_at).getTime()) /
                60000,
            ),
          );
          totalDuration += actual;
          countedDurations += 1;
          if (planned > 0) {
            if (actual <= planned) {
              onTime += 1;
            } else {
              totalOverrun += actual - planned;
              overrunCount += 1;
            }
          }
        }
      }

      const workloadPct =
        plannedMinutes > 0
          ? round2((plannedMinutes / DEFAULT_SHIFT_MINUTES) * 100)
          : 0;
      const avgDuration =
        countedDurations > 0
          ? Math.round(totalDuration / countedDurations)
          : 0;
      const avgOverrun =
        overrunCount > 0 ? Math.round(totalOverrun / overrunCount) : 0;
      const onTimeRate =
        finished > 0 ? round2((onTime / finished) * 100) : null;
      const revenue = revenueByGroomer.get(groomerId) ?? 0;

      teamFinished += finished;
      teamOnTime += onTime;
      teamTotalDuration += totalDuration;
      teamCountedSessions += countedDurations;
      teamRevenue += revenue;

      items.push({
        groomer_id: groomerId,
        groomer_name: nameById.get(groomerId) ?? 'Unknown',
        orders_completed: finished,
        in_progress: inProgress,
        avg_session_duration_min: avgDuration,
        avg_overrun_mins: avgOverrun,
        workload_pct: workloadPct,
        on_time_rate_pct: onTimeRate,
        revenue_attributed: Math.round(revenue),
      });
    }

    items.sort((a, b) => b.orders_completed - a.orders_completed);

    return {
      today: today.toISOString(),
      groomers: items,
      team_on_time_rate_pct:
        teamFinished > 0 ? round2((teamOnTime / teamFinished) * 100) : null,
      team_avg_session_duration_min:
        teamCountedSessions > 0
          ? Math.round(teamTotalDuration / teamCountedSessions)
          : 0,
      team_revenue_attributed: Math.round(teamRevenue),
    };
  }

  private async aggregateSessionsToday(
    today: Date,
    tomorrow: Date,
    storeMatch: Record<string, any>,
  ) {
    return this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            date: { $gte: today, $lt: tomorrow },
            isDeleted: { $ne: true },
          },
        },
        { $unwind: { path: '$sessions', preserveNullAndEmptyArrays: false } },
        { $match: { 'sessions.groomer_id': { $ne: null } } },
        {
          $project: {
            groomer_id: '$sessions.groomer_id',
            status: '$sessions.status',
            started_at: '$sessions.started_at',
            finished_at: '$sessions.finished_at',
            ideal_duration: { $ifNull: ['$sessions.ideal_duration', 0] },
            service_duration: {
              $ifNull: ['$service_snapshot.duration', 0],
            },
          },
        },
      ])
      .exec();
  }

  /**
   * Revenue attribution per groomer for bookings completed today.
   * Solo (1 groomer) = 100% of final_total_price.
   * Shared (N groomers) = 1/N each.
   */
  private async aggregateRevenueAttributionToday(
    today: Date,
    tomorrow: Date,
    storeMatch: Record<string, any>,
  ): Promise<{ _id: Types.ObjectId; revenue: number }[]> {
    return this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: 'completed',
            isDeleted: { $ne: true },
          },
        },
        withEffectiveCompletedAt(),
        {
          $match: {
            [EFFECTIVE_COMPLETED_AT_FIELD]: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $addFields: {
            unique_groomers: {
              $setUnion: [
                {
                  $filter: {
                    input: {
                      $map: {
                        input: { $ifNull: ['$sessions', []] },
                        as: 's',
                        in: '$$s.groomer_id',
                      },
                    },
                    as: 'gid',
                    cond: { $ne: ['$$gid', null] },
                  },
                },
                [],
              ],
            },
          },
        },
        {
          $match: {
            'unique_groomers.0': { $exists: true },
          },
        },
        {
          $addFields: {
            attributed_per_groomer: {
              $divide: [
                { $ifNull: ['$final_total_price', 0] },
                { $size: '$unique_groomers' },
              ],
            },
          },
        },
        { $unwind: '$unique_groomers' },
        {
          $group: {
            _id: '$unique_groomers',
            revenue: { $sum: '$attributed_per_groomer' },
          },
        },
      ])
      .exec();
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
