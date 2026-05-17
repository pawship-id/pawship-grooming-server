import { PipelineStage } from 'mongoose';

/**
 * Effective completion timestamp.
 *
 * `Booking.completed_at` is a recently-added analytics field, only written on
 * the transition into BookingStatus.COMPLETED. Legacy / imported-from-prod rows
 * may have it null. To keep dashboard metrics correct without depending on a
 * one-off backfill, every "completed bookings within a date range" query should
 * resolve the timestamp as:
 *
 *   completed_at  ??  max(status_logs[status === 'completed'].timestamp)  ??  null
 *
 * Use {@link withEffectiveCompletedAt} as an aggregation stage and match the
 * date range against {@link EFFECTIVE_COMPLETED_AT_FIELD}; use
 * {@link resolveCompletedAt} for non-aggregation (find/lean) code paths.
 */
export const EFFECTIVE_COMPLETED_AT_FIELD = 'completed_at_eff';

/**
 * `$addFields` stage that materialises {@link EFFECTIVE_COMPLETED_AT_FIELD}.
 *
 * Place this AFTER the cheap equality `$match`
 * (`booking_status`, `store_id`, `isDeleted`) and BEFORE the date-range
 * `$match` produced by {@link completedAtRangeMatch}.
 */
export function withEffectiveCompletedAt(): PipelineStage.AddFields {
  return {
    $addFields: {
      [EFFECTIVE_COMPLETED_AT_FIELD]: {
        $ifNull: [
          '$completed_at',
          {
            $max: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$status_logs', []] },
                    as: 'log',
                    cond: { $eq: ['$$log.status', 'completed'] },
                  },
                },
                as: 'l',
                in: '$$l.timestamp',
              },
            },
          },
        ],
      },
    },
  };
}

/** Range `$match` on the effective completion timestamp. */
export function completedAtRangeMatch(
  from: Date,
  to: Date,
): Record<string, unknown> {
  return { [EFFECTIVE_COMPLETED_AT_FIELD]: { $gte: from, $lte: to } };
}

interface StatusLogLike {
  status?: string;
  timestamp?: Date | string | null;
}

interface BookingLike {
  completed_at?: Date | string | null;
  status_logs?: StatusLogLike[] | null;
}

/**
 * JS equivalent of {@link withEffectiveCompletedAt} for find/lean code paths.
 * Returns the effective completion `Date`, or null when none can be derived.
 */
export function resolveCompletedAt(booking: BookingLike): Date | null {
  if (booking?.completed_at) return new Date(booking.completed_at);

  const logs = Array.isArray(booking?.status_logs) ? booking.status_logs : [];
  const completedTs = logs
    .filter((log) => log?.status === 'completed' && log?.timestamp)
    .map((log) => new Date(log.timestamp as Date | string).getTime())
    .filter((t) => !Number.isNaN(t));

  if (completedTs.length === 0) return null;
  return new Date(Math.max(...completedTs));
}
