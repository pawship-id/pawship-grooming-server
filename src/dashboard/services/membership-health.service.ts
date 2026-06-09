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
import { User, UserDocument } from 'src/user/entities/user.entity';
import { UserRole } from 'src/user/dto/user.dto';
import { parseRange, toUtcStartOfDay } from '../utils/date-range';

export interface MembershipTierItem {
  tier: string;
  count: number;
  pct: number;
}

export interface MembershipHealthResponse {
  range: { from: string; to: string };
  active_memberships: number;
  active_count: number;
  pending_count: number;
  member_pet_count: number;
  member_customer_count: number;
  new_memberships: number;
  membership_revenue: number;
  avg_membership_value: number;
  renewal_rate_pct: number | null;
  expiring_7_days: number;
  expiring_30_days: number;
  penetration_rate_pct: number;
  tier_breakdown: MembershipTierItem[];
  total_customers: number;
  active_member_customers: number;
  non_member_customers: number;
  ex_member_customers: number;
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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getMembershipHealth(
    args: MembershipHealthArgs,
  ): Promise<MembershipHealthResponse> {
    const range = parseRange(args.from, args.to);
    const now = new Date();
    const today = toUtcStartOfDay(now);

    const in7 = new Date(today);
    in7.setUTCDate(in7.getUTCDate() + 7);
    in7.setUTCHours(23, 59, 59, 999);

    const in30 = new Date(today);
    in30.setUTCDate(in30.getUTCDate() + 30);
    in30.setUTCHours(23, 59, 59, 999);

    const ago30 = new Date(today);
    ago30.setUTCDate(ago30.getUTCDate() - 30);

    // Active member = membership yang masih berlaku (status active + pending),
    // yaitu is_active true (belum dibatalkan), belum dihapus, dan end_date belum
    // lewat. Status detail mengikuti computeStatus di pet-membership.service:
    //   pending = tanggal mulai masih di masa depan (start_date > now)
    //   active  = sudah berjalan (start_date <= now) dan belum berakhir
    const activeMemberMatch = {
      is_active: true,
      isDeleted: { $ne: true },
      end_date: { $gte: today },
    };

    const [
      statusAgg,
      reachAgg,
      newInPeriod,
      expiring7,
      expiring30,
      tierAgg,
      totalPets,
      renewalData,
      totalCustomers,
      everMemberAgg,
    ] = await Promise.all([
      this.petMembershipModel
        .aggregate([
          { $match: activeMemberMatch },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: { $cond: [{ $lte: ['$start_date', now] }, 1, 0] },
              },
              pending: {
                $sum: { $cond: [{ $gt: ['$start_date', now] }, 1, 0] },
              },
            },
          },
        ])
        .exec(),
      // Jangkauan unik: pet & customer berbeda yang punya membership berlaku.
      // Distinct pet_id dulu, lalu join ke pet terdaftar (aktif, belum dihapus)
      // agar penetrasi tidak melebihi total pet terdaftar.
      this.petMembershipModel
        .aggregate([
          { $match: activeMemberMatch },
          { $group: { _id: '$pet_id' } },
          {
            $lookup: {
              from: 'pets',
              localField: '_id',
              foreignField: '_id',
              as: 'pet',
            },
          },
          { $unwind: '$pet' },
          { $match: { 'pet.is_active': true, 'pet.isDeleted': { $ne: true } } },
          {
            $group: {
              _id: null,
              pet_count: { $sum: 1 },
              customers: { $addToSet: '$pet.customer_id' },
            },
          },
          {
            $project: {
              pet_count: 1,
              customer_count: { $size: '$customers' },
            },
          },
        ])
        .exec(),
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
      // Distribusi tier mengikuti pembelian membership pada periode terpilih
      // (sama dengan "No of Purchase" di kartu Period Income): hanya pembelian
      // aktif (tidak dibatalkan) yang createdAt-nya dalam rentang tanggal,
      // dikelompokkan menurut nama paket.
      this.petMembershipModel
        .aggregate([
          {
            $match: {
              is_active: true,
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
      // Total customer = user role customer yang aktif & belum dihapus.
      this.userModel.countDocuments({
        role: UserRole.CUSTOMER,
        is_active: true,
        isDeleted: { $ne: true },
      }),
      // Ever-member: customer unik yang pernah punya membership apa pun (belum
      // dihapus), join ke pet aktif agar konsisten dengan member_customer_count.
      this.petMembershipModel
        .aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$pet_id' } },
          {
            $lookup: {
              from: 'pets',
              localField: '_id',
              foreignField: '_id',
              as: 'pet',
            },
          },
          { $unwind: '$pet' },
          { $match: { 'pet.is_active': true, 'pet.isDeleted': { $ne: true } } },
          {
            $group: { _id: null, customers: { $addToSet: '$pet.customer_id' } },
          },
          { $project: { customer_count: { $size: '$customers' } } },
        ])
        .exec(),
    ]);

    const statusRow = statusAgg[0] ?? { total: 0, active: 0, pending: 0 };
    const activeMembers = statusRow.total ?? 0;
    const activeOnly = statusRow.active ?? 0;
    const pendingOnly = statusRow.pending ?? 0;

    const reachRow = reachAgg[0] ?? { pet_count: 0, customer_count: 0 };
    const memberPetCount = reachRow.pet_count ?? 0;
    const memberCustomerCount = reachRow.customer_count ?? 0;

    const newRow = newInPeriod[0] ?? { count: 0, revenue: 0 };
    const newCount = newRow.count ?? 0;
    const newRevenue = newRow.revenue ?? 0;

    // Klasifikasi customer (current-state, global):
    //   Active member = customer unik yang punya membership aktif/pending now.
    //   Non member    = total customer − active member.
    //   Ex member     = pernah punya membership tapi kini tidak ada yang
    //                   aktif/pending (subset dari non member).
    const everMemberCustomers = everMemberAgg[0]?.customer_count ?? 0;
    const activeMemberCustomers = memberCustomerCount;
    const nonMemberCustomers = Math.max(
      0,
      totalCustomers - activeMemberCustomers,
    );
    const exMemberCustomers = Math.max(
      0,
      everMemberCustomers - activeMemberCustomers,
    );

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
      active_memberships: activeMembers,
      active_count: activeOnly,
      pending_count: pendingOnly,
      member_pet_count: memberPetCount,
      member_customer_count: memberCustomerCount,
      new_memberships: newCount,
      membership_revenue: newRevenue,
      avg_membership_value:
        newCount > 0 ? Math.round(newRevenue / newCount) : 0,
      renewal_rate_pct: renewalData.rate,
      expiring_7_days: expiring7,
      expiring_30_days: expiring30,
      // Penetrasi = pet terdaftar yang punya membership berlaku ÷ total pet
      // terdaftar. Memakai jumlah pet unik (bukan jumlah membership) agar
      // tidak melebihi 100% saat satu pet punya lebih dari satu membership.
      penetration_rate_pct:
        totalPets > 0 ? round2((memberPetCount / totalPets) * 100) : 0,
      tier_breakdown,
      total_customers: totalCustomers,
      active_member_customers: activeMemberCustomers,
      non_member_customers: nonMemberCustomers,
      ex_member_customers: exMemberCustomers,
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
