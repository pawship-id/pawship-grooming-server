import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Membership,
  MembershipDocument,
} from 'src/membership/entities/membership.entity';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from 'src/pet-membership/entities/pet-membership.entity';
import { parseRange, toUtcStartOfDay } from '../utils/date-range';

export interface MembershipTierItem {
  tier: string;
  count: number;
  pct: number;
}

export interface MembershipHealthResponse {
  range: { from: string; to: string };
  active_memberships: number;
  new_memberships: number;
  membership_revenue: number;
  avg_membership_value: number;
  renewal_rate_pct: number | null;
  expiring_7_days: number;
  expiring_30_days: number;
  penetration_rate_pct: number;
  tier_breakdown: MembershipTierItem[];
}

interface MembershipHealthArgs {
  from?: string;
  to?: string;
}

@Injectable()
export class MembershipHealthService {
  constructor(
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
  ) {}

  async getMembershipHealth(
    args: MembershipHealthArgs,
  ): Promise<MembershipHealthResponse> {
    const range = parseRange(args.from, args.to);
    const today = toUtcStartOfDay(new Date());

    const in7 = new Date(today);
    in7.setUTCDate(in7.getUTCDate() + 7);
    in7.setUTCHours(23, 59, 59, 999);

    const in30 = new Date(today);
    in30.setUTCDate(in30.getUTCDate() + 30);
    in30.setUTCHours(23, 59, 59, 999);

    const ago30 = new Date(today);
    ago30.setUTCDate(ago30.getUTCDate() - 30);

    const [
      activeCount,
      newInPeriod,
      expiring7,
      expiring30,
      tierAgg,
      totalPets,
      renewalData,
    ] = await Promise.all([
      this.petMembershipModel.countDocuments({
        is_active: true,
        isDeleted: { $ne: true },
        end_date: { $gte: today },
      }),
      this.petMembershipModel
        .aggregate([
          {
            $match: {
              // Selaras dengan kartu "Membership Revenue" di tab Ringkasan
              // (revenue.service.aggregateMembership): hanya pembelian aktif,
              // tidak termasuk yang dibatalkan (cancelled = is_active false).
              is_active: true,
              createdAt: { $gte: range.from, $lte: range.to },
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              revenue: { $sum: { $ifNull: ['$purchase_price', 0] } },
            },
          },
        ])
        .exec(),
      this.petMembershipModel.countDocuments({
        is_active: true,
        isDeleted: { $ne: true },
        end_date: { $gte: today, $lte: in7 },
      }),
      this.petMembershipModel.countDocuments({
        is_active: true,
        isDeleted: { $ne: true },
        end_date: { $gte: today, $lte: in30 },
      }),
      this.petMembershipModel
        .aggregate([
          {
            $match: {
              createdAt: { $gte: range.from, $lte: range.to },
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: 'memberships',
              localField: 'membership_plan_id',
              foreignField: '_id',
              as: 'plan',
            },
          },
          { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { $ifNull: ['$plan.name', 'Tidak diketahui'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .exec(),
      this.petModel.countDocuments({
        is_active: true,
        isDeleted: { $ne: true },
      }),
      this.computeRenewalRate(ago30, today),
    ]);

    const newRow = newInPeriod[0] ?? { count: 0, revenue: 0 };
    const newCount = newRow.count ?? 0;
    const newRevenue = newRow.revenue ?? 0;

    const tierTotal = tierAgg.reduce((acc, t) => acc + (t.count ?? 0), 0);
    const tier_breakdown: MembershipTierItem[] = tierAgg.map((t) => ({
      tier: String(t._id ?? 'Tidak diketahui'),
      count: t.count ?? 0,
      pct: tierTotal > 0 ? round2((t.count / tierTotal) * 100) : 0,
    }));

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      active_memberships: activeCount,
      new_memberships: newCount,
      membership_revenue: newRevenue,
      avg_membership_value:
        newCount > 0 ? Math.round(newRevenue / newCount) : 0,
      renewal_rate_pct: renewalData.rate,
      expiring_7_days: expiring7,
      expiring_30_days: expiring30,
      penetration_rate_pct:
        totalPets > 0 ? round2((activeCount / totalPets) * 100) : 0,
      tier_breakdown,
    };
  }

  /**
   * Rolling-30-day renewal rate.
   * Denominator: pets whose last membership ended in the last 30 days.
   * Numerator: those that have an active or future-dated membership today.
   */
  private async computeRenewalRate(
    windowFrom: Date,
    today: Date,
  ): Promise<{ rate: number | null }> {
    const expiredMemberships = await this.petMembershipModel
      .aggregate([
        {
          $match: {
            end_date: { $gte: windowFrom, $lt: today },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$pet_id',
            last_expiry: { $max: '$end_date' },
          },
        },
      ])
      .exec();

    if (expiredMemberships.length === 0) return { rate: null };

    const petIds = expiredMemberships.map((e) => e._id);

    const renewed = await this.petMembershipModel
      .find({
        pet_id: { $in: petIds },
        isDeleted: { $ne: true },
        end_date: { $gte: today },
      })
      .distinct('pet_id')
      .exec();

    const denom = expiredMemberships.length;
    const numer = renewed.length;
    return { rate: round2((numer / denom) * 100) };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
