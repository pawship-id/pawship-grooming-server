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
  previousRange,
  toUtcStartOfDay,
} from '../utils/date-range';

export interface RevenueKpis {
  gross_revenue: number;
  net_revenue: number;
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
  net_revenue: number;
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
  net_revenue: number;
  pct_of_total: number;
}

export interface DiscountBreakdown {
  membership_benefit_total: number;
  promotion_discount_total: number;
  admin_discount_total: number;
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
  by_service_type_grooming: RevenueByServiceTypeItem[];
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
      this.aggregateMembership(range),
      this.aggregateTrend7d(storeMatch),
    ]);

    // 2B grooming-only: filter rows where title mentions "grooming"
    const groomingTotal = byServiceTypeAll
      .filter((r) => titleMentions(r.service_type, 'grooming'))
      .reduce((acc, r) => acc + r.net_revenue, 0);

    const byServiceTypeGrooming: RevenueByServiceTypeItem[] = byServiceTypeAll
      .filter((r) => titleMentions(r.service_type, 'grooming'))
      .map((r) => ({
        service_type: r.service_type,
        net_revenue: r.net_revenue,
        pct_of_total:
          groomingTotal > 0 ? round2((r.net_revenue / groomingTotal) * 100) : 0,
        order_count: r.order_count,
      }))
      .sort((a, b) => b.net_revenue - a.net_revenue);

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

    const kpis: RevenueKpis = {
      gross_revenue: current.gross,
      net_revenue: current.net,
      total_discount: current.discount,
      discount_leakage_pct:
        current.gross > 0
          ? round2((current.discount / current.gross) * 100)
          : 0,
      total_orders: current.orders,
      avg_order_value:
        current.orders > 0 ? Math.round(current.net / current.orders) : 0,
      delta: {
        gross_revenue_pct: pctDelta(current.gross, previous.gross),
        net_revenue_pct: pctDelta(current.net, previous.net),
        total_orders_pct: pctDelta(current.orders, previous.orders),
        avg_order_value_pct: pctDelta(
          current.orders > 0 ? current.net / current.orders : 0,
          previous.orders > 0 ? previous.net / previous.orders : 0,
        ),
      },
    };

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      kpis,
      by_service_type_grooming: byServiceTypeGrooming,
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
            booking_status: 'completed',
            completed_at: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            gross: { $sum: { $ifNull: ['$original_total_price', 0] } },
            net: { $sum: { $ifNull: ['$final_total_price', 0] } },
            discount: { $sum: { $ifNull: ['$total_discount', 0] } },
            orders: { $sum: 1 },
          },
        },
      ])
      .exec();

    return {
      gross: row?.gross ?? 0,
      net: row?.net ?? 0,
      discount: row?.discount ?? 0,
      orders: row?.orders ?? 0,
    };
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
            booking_status: 'completed',
            completed_at: { $gte: range.from, $lte: range.to },
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
            net_revenue: { $sum: { $ifNull: ['$final_total_price', 0] } },
            order_count: { $sum: 1 },
          },
        },
        { $sort: { net_revenue: -1 } },
      ])
      .exec();

    return rows.map((r) => ({
      service_type: String(r._id),
      net_revenue: r.net_revenue ?? 0,
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
            booking_status: 'completed',
            completed_at: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
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
    promotion_discount_total: number;
    admin_discount_total: number;
  }> {
    const [row] = await this.bookingModel
      .aggregate([
        {
          $match: {
            ...storeMatch,
            booking_status: 'completed',
            completed_at: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
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
            promotion_discount_total: { $sum: '$promotions_total' },
            admin_discount_total: { $sum: '$admin_total' },
          },
        },
      ])
      .exec();

    return {
      membership_benefit_total: row?.membership_benefit_total ?? 0,
      promotion_discount_total: row?.promotion_discount_total ?? 0,
      admin_discount_total: row?.admin_discount_total ?? 0,
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
      buckets[cat] += row.net_revenue;
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
        net_revenue: buckets[cat],
        pct_of_total: total > 0 ? round2((buckets[cat] / total) * 100) : 0,
      }))
      .filter((item) => item.net_revenue > 0 || item.category !== 'other');
  }

  private async aggregateMembership(range: {
    from: Date;
    to: Date;
  }): Promise<MembershipRevenue> {
    const [row] = await this.petMembershipModel
      .aggregate([
        {
          $match: {
            createdAt: { $gte: range.from, $lte: range.to },
            isDeleted: { $ne: true },
          },
        },
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
            booking_status: 'completed',
            completed_at: { $gte: start, $lte: end },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { date: '$completed_at', format: '%Y-%m-%d' },
            },
            gross: { $sum: { $ifNull: ['$original_total_price', 0] } },
            net: { $sum: { $ifNull: ['$final_total_price', 0] } },
          },
        },
      ])
      .exec();

    const byDay = new Map<string, { gross: number; net: number }>();
    for (const r of rows) {
      byDay.set(r._id, { gross: r.gross ?? 0, net: r.net ?? 0 });
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

function titleMentions(title: string, keyword: string): boolean {
  return title.toLowerCase().includes(keyword);
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
