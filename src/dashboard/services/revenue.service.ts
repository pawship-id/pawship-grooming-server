import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from 'src/pet-membership/entities/pet-membership.entity';
import {
  parseRange,
  parseRangeOrNull,
  previousRange,
  toUtcStartOfDay,
} from '../utils/date-range';

const EXCLUDED_REVENUE_STATUSES = ['cancelled', 'rescheduled'];
const COMPLETED_ORDER_STATUSES = ['completed', 'returned'];

export interface RevenueKpis {
  gross_revenue: number;
  gross_revenue_confirmed: number;
  gross_revenue_pending: number;
  net_revenue: number;
  net_revenue_confirmed: number;
  net_revenue_pending: number;
  total_discount: number;
  discount_leakage_pct: number;
  total_orders: number;
  avg_order_value: number;
  delta: {
    gross_revenue_pct: number | null;
    net_revenue_pct: number | null;
    total_orders_pct: number | null;
    avg_order_value_pct: number | null;
  };
}

export interface RevenueByServiceTypeItem {
  service_type: string;
  revenue: number;
  pct_of_total: number;
  order_count: number;
}

export interface RevenueByGroomingServiceItem {
  service_id: string | null;
  service_name: string;
  revenue: number;
  pct_of_total: number;
  order_count: number;
}

export type LayananCategory =
  | 'grooming'
  | 'hotel'
  | 'daycare'
  | 'spa'
  | 'addon'
  | 'pickup'
  | 'other';

export interface RevenueByLayananCategoryItem {
  category: LayananCategory;
  label: string;
  revenue: number;
  pct_of_total: number;
}

export interface DiscountBreakdown {
  membership_benefit_total: number;
  membership_benefit_order_count: number;
  promotion_discount_total: number;
  promotion_discount_order_count: number;
  admin_discount_total: number;
  admin_discount_order_count: number;
  total_attributed: number;
  leakage_pct: number;
}

export interface MembershipRevenue {
  membership_revenue: number;
  new_memberships_count: number;
  avg_membership_value: number;
}

export interface RevenueTrendPoint {
  date: string; // YYYY-MM-DD
  gross: number;
  net: number;
}

export interface RevenueResponse {
  range: { from: string; to: string };
  kpis: RevenueKpis;
  by_grooming_service: RevenueByGroomingServiceItem[];
  by_layanan_category: RevenueByLayananCategoryItem[];
  discount_breakdown: DiscountBreakdown;
  membership: MembershipRevenue;
  trend7d: RevenueTrendPoint[];
}

interface RevenueQueryArgs {
  storeId?: string;
  from?: string;
  to?: string;
}

const CATEGORY_LABEL: Record<LayananCategory, string> = {
  grooming: 'Grooming',
  hotel: 'Hotel',
  daycare: 'Daycare',
  spa: 'Spa',
  addon: 'Add-ons',
  pickup: 'Pickup / Delivery',
  other: 'Lainnya',
};

@Injectable()
export class RevenueService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
  ) {}

  async getRevenue(args: RevenueQueryArgs): Promise<RevenueResponse> {
    const range = parseRange(args.from, args.to);
    const prevRange = previousRange(range);
    const storeMatch = buildStoreMatch(args.storeId);

    const [
      current,
      previous,
      byServiceTypeAll,
      byPickup,
      discounts,
      membership,
      trend7d,
    ] = await Promise.all([
      this.aggregateKpis(range, storeMatch),
      this.aggregateKpis(prevRange, storeMatch),
      this.aggregateByServiceType(range, storeMatch),
      this.aggregateAddonAndPickup(range, storeMatch),
      this.aggregateDiscountBreakdown(range, storeMatch),
      this.aggregateMembership(args.from, args.to),
      this.aggregateTrend7d(storeMatch),
    ]);

    // 2B grooming-only: breakdown per individual grooming service
    const byGroomingService = await this.aggregateGroomingServices(
      range,
      storeMatch,
    );

    // 2C layanan category: bucket all titles into 6 + addon/pickup standalone
    const byLayananCategory = this.bucketByCategory(byServiceTypeAll, byPickup);

    // 2E discount breakdown + leakage
    const totalAttributed =
      discounts.membership_benefit_total +
      discounts.promotion_discount_total +
      discounts.admin_discount_total;
    const discountBreakdown: DiscountBreakdown = {
      ...discounts,
      total_attributed: totalAttributed,
      leakage_pct:
        current.gross > 0 ? round2((totalAttributed / current.gross) * 100) : 0,
    };

    const currentNet = current.gross - current.discount;
    const previousNet = previous.gross - previous.discount;
    const currentNetCompleted =
      current.gross_completed - current.discount_completed;
    const previousNetCompleted =
      previous.gross_completed - previous.discount_completed;

    const kpis: RevenueKpis = {
      gross_revenue: current.gross,
      gross_revenue_confirmed: current.gross_completed,
      gross_revenue_pending: current.gross - current.gross_completed,
      net_revenue: currentNet,
      net_revenue_confirmed: currentNetCompleted,
      net_revenue_pending: currentNet - currentNetCompleted,
      total_discount: current.discount,
      discount_leakage_pct:
        current.gross > 0
          ? round2((current.discount / current.gross) * 100)
          : 0,
      total_orders: current.orders_completed,
      avg_order_value:
        current.orders_completed > 0
          ? Math.round(currentNetCompleted / current.orders_completed)
          : 0,
      delta: {
        gross_revenue_pct: pctDelta(current.gross, previous.gross),
        net_revenue_pct: pctDelta(currentNet, previousNet),
        total_orders_pct: pctDelta(
          current.orders_completed,
          previous.orders_completed,
        ),
        avg_order_value_pct: pctDelta(
          current.orders_completed > 0
            ? currentNetCompleted / current.orders_completed
            : 0,
          previous.orders_completed > 0
            ? previousNetCompleted / previous.orders_completed
            : 0,
        ),
      },
    };

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      kpis,
      by_grooming_service: byGroomingService,
      by_layanan_category: byLayananCategory,
      discount_breakdown: discountBreakdown,
      membership,
      trend7d,
    };
  }

  private async aggregateKpis(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ) {
    const [row] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: null,
            gross: { $sum: { $ifNull: ['$original_total_price', 0] } },
            discount: { $sum: { $ifNull: ['$total_discount', 0] } },
            gross_completed: {
              $sum: {
                $cond: [
                  { $in: ['$booking_status', COMPLETED_ORDER_STATUSES] },
                  { $ifNull: ['$original_total_price', 0] },
                  0,
                ],
              },
            },
            discount_completed: {
              $sum: {
                $cond: [
                  { $in: ['$booking_status', COMPLETED_ORDER_STATUSES] },
                  { $ifNull: ['$total_discount', 0] },
                  0,
                ],
              },
            },
            orders_completed: {
              $sum: {
                $cond: [
                  { $in: ['$booking_status', COMPLETED_ORDER_STATUSES] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    return {
      gross: row?.gross ?? 0,
      discount: row?.discount ?? 0,
      gross_completed: row?.gross_completed ?? 0,
      discount_completed: row?.discount_completed ?? 0,
      orders_completed: row?.orders_completed ?? 0,
    };
  }

  private async aggregateGroomingServices(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<RevenueByGroomingServiceItem[]> {
    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: range.from, $lte: range.to },
            'service_snapshot.service_type.title': { $regex: /grooming/i },
          },
        },
        {
          $group: {
            _id: {
              service_id: '$service_snapshot._id',
              service_name: {
                $ifNull: ['$service_snapshot.name', 'Tidak diketahui'],
              },
            },
            revenue: { $sum: { $ifNull: ['$service_snapshot.price', 0] } },
            order_count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ])
      .exec();

    const total = rows.reduce((acc, r) => acc + (r.revenue ?? 0), 0);

    return rows.map((r) => ({
      service_id: r._id?.service_id ? String(r._id.service_id) : null,
      service_name: String(r._id?.service_name ?? 'Tidak diketahui'),
      revenue: r.revenue ?? 0,
      order_count: r.order_count ?? 0,
      pct_of_total: total > 0 ? round2((r.revenue / total) * 100) : 0,
    }));
  }

  private async aggregateByServiceType(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<RevenueByServiceTypeItem[]> {
    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: range.from, $lte: range.to },
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
            revenue: {
              $sum: { $ifNull: ['$service_snapshot.price', 0] },
            },
            order_count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ])
      .exec();

    return rows.map((r) => ({
      service_type: String(r._id),
      revenue: r.revenue ?? 0,
      pct_of_total: 0, // computed by callers for their scope
      order_count: r.order_count ?? 0,
    }));
  }

  /**
   * Aggregate addon revenue (sub_total_service - service price) and pickup revenue
   * (pickup_fee + delivery_fee + travel_fee) separately so they can be shown in
   * the layanan category breakdown.
   */
  private async aggregateAddonAndPickup(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<{ addon: number; pickup: number }> {
    const [row] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: null,
            addon: {
              $sum: {
                $max: [
                  {
                    $subtract: [
                      { $ifNull: ['$sub_total_service', 0] },
                      { $ifNull: ['$service_snapshot.price', 0] },
                    ],
                  },
                  0,
                ],
              },
            },
            pickup: {
              $sum: {
                $add: [
                  { $ifNull: ['$pickup_fee', 0] },
                  { $ifNull: ['$delivery_fee', 0] },
                  { $ifNull: ['$travel_fee', 0] },
                ],
              },
            },
          },
        },
      ])
      .exec();

    return { addon: row?.addon ?? 0, pickup: row?.pickup ?? 0 };
  }

  private async aggregateDiscountBreakdown(
    range: { from: Date; to: Date },
    storeMatch: Record<string, any>,
  ): Promise<{
    membership_benefit_total: number;
    membership_benefit_order_count: number;
    promotion_discount_total: number;
    promotion_discount_order_count: number;
    admin_discount_total: number;
    admin_discount_order_count: number;
  }> {
    const [row] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $project: {
            benefits_total: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$applied_benefits', []] },
                  as: 'b',
                  in: { $ifNull: ['$$b.amount_deducted', 0] },
                },
              },
            },
            promotions_total: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$applied_promotions', []] },
                  as: 'p',
                  in: { $ifNull: ['$$p.amount_deducted', 0] },
                },
              },
            },
            admin_total: {
              $add: [
                { $ifNull: ['$edited_service_discount', 0] },
                { $ifNull: ['$edited_travel_fee_discount', 0] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ['$edited_addon_prices', []] },
                      as: 'a',
                      in: { $ifNull: ['$$a.discount', 0] },
                    },
                  },
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            membership_benefit_total: { $sum: '$benefits_total' },
            membership_benefit_order_count: {
              $sum: { $cond: [{ $gt: ['$benefits_total', 0] }, 1, 0] },
            },
            promotion_discount_total: { $sum: '$promotions_total' },
            promotion_discount_order_count: {
              $sum: { $cond: [{ $gt: ['$promotions_total', 0] }, 1, 0] },
            },
            admin_discount_total: { $sum: '$admin_total' },
            admin_discount_order_count: {
              $sum: { $cond: [{ $gt: ['$admin_total', 0] }, 1, 0] },
            },
          },
        },
      ])
      .exec();

    return {
      membership_benefit_total: row?.membership_benefit_total ?? 0,
      membership_benefit_order_count: row?.membership_benefit_order_count ?? 0,
      promotion_discount_total: row?.promotion_discount_total ?? 0,
      promotion_discount_order_count: row?.promotion_discount_order_count ?? 0,
      admin_discount_total: row?.admin_discount_total ?? 0,
      admin_discount_order_count: row?.admin_discount_order_count ?? 0,
    };
  }

  private bucketByCategory(
    byServiceTypeAll: RevenueByServiceTypeItem[],
    byPickup: { addon: number; pickup: number },
  ): RevenueByLayananCategoryItem[] {
    const buckets: Record<LayananCategory, number> = {
      grooming: 0,
      hotel: 0,
      daycare: 0,
      spa: 0,
      addon: byPickup.addon,
      pickup: byPickup.pickup,
      other: 0,
    };

    for (const row of byServiceTypeAll) {
      const cat = classifyTitle(row.service_type);
      buckets[cat] += row.revenue;
    }

    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    const order: LayananCategory[] = [
      'grooming',
      'hotel',
      'daycare',
      'spa',
      'addon',
      'pickup',
      'other',
    ];

    return order
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABEL[cat],
        revenue: buckets[cat],
        pct_of_total: total > 0 ? round2((buckets[cat] / total) * 100) : 0,
      }))
      .filter((item) => item.revenue > 0 || item.category !== 'other');
  }

  private async aggregateMembership(
    from?: string,
    to?: string,
  ): Promise<MembershipRevenue> {
    // Hitung semua pembelian membership yang statusnya bukan "Dibatalkan".
    // Cancelled = is_active: false (lihat computeStatus di pet-membership.service).
    const match: Record<string, any> = {
      is_active: true,
      isDeleted: { $ne: true },
    };

    // Filter periode hanya jika range diberikan; tanpa range = all time.
    const range = parseRangeOrNull(from, to);
    if (range) {
      match.createdAt = { $gte: range.from, $lte: range.to };
    }

    const [row] = await this.petMembershipModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $ifNull: ['$purchase_price', 0] } },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const revenue = row?.revenue ?? 0;
    const count = row?.count ?? 0;
    return {
      membership_revenue: revenue,
      new_memberships_count: count,
      avg_membership_value: count > 0 ? Math.round(revenue / count) : 0,
    };
  }

  private async aggregateTrend7d(
    storeMatch: Record<string, any>,
  ): Promise<RevenueTrendPoint[]> {
    const today = toUtcStartOfDay(new Date());
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    const end = new Date(today);
    end.setUTCHours(23, 59, 59, 999);

    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: { $nin: EXCLUDED_REVENUE_STATUSES },
            isDeleted: { $ne: true },
            date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { date: '$date', format: '%Y-%m-%d' },
            },
            gross: { $sum: { $ifNull: ['$original_total_price', 0] } },
            discount: { $sum: { $ifNull: ['$total_discount', 0] } },
          },
        },
      ])
      .exec();

    const byDay = new Map<string, { gross: number; net: number }>();
    for (const r of rows) {
      const gross = r.gross ?? 0;
      const discount = r.discount ?? 0;
      byDay.set(r._id, { gross, net: gross - discount });
    }

    const result: RevenueTrendPoint[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const found = byDay.get(key);
      result.push({
        date: key,
        gross: found?.gross ?? 0,
        net: found?.net ?? 0,
      });
    }
    return result;
  }
}

function buildStoreMatch(storeId?: string): Record<string, any> {
  if (!storeId || storeId === 'all') return {};
  if (!Types.ObjectId.isValid(storeId)) return {};
  return { store_id: new Types.ObjectId(storeId) };
}

function classifyTitle(title: string): LayananCategory {
  const t = title.toLowerCase();
  if (t.includes('grooming')) return 'grooming';
  if (t.includes('hotel') || t.includes('boarding')) return 'hotel';
  if (t.includes('daycare') || t.includes('play')) return 'daycare';
  if (t.includes('spa') || t.includes('treatment')) return 'spa';
  return 'other';
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
