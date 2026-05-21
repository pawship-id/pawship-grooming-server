import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from 'src/pet-membership/entities/pet-membership.entity';
import {
  EFFECTIVE_COMPLETED_AT_FIELD,
  withEffectiveCompletedAt,
} from '../utils/completed-at';

type Urgency = 'critical' | 'upcoming';
type VisitTag = '1st' | '2nd';

export interface MembershipEndingItem {
  pet_id: string;
  pet_name: string;
  customer_name: string;
  tier: string;
  expiry_date: string;
  days_remaining: number;
  urgency: Urgency;
}

export interface IdlePetItem {
  pet_id: string;
  pet_name: string;
  breed: string | null;
  customer_name: string;
  last_visit_at: string;
  days_since: number;
}

export interface NeedFollowUpItem {
  booking_id: string;
  pet_id: string;
  pet_name: string;
  customer_name: string;
  visit_tag: VisitTag;
  service_name: string;
  groomer_name: string | null;
  completed_at: string;
}

export interface NeedsActionResponse {
  membershipEnding: { items: MembershipEndingItem[]; total: number };
  idlePets: { items: IdlePetItem[]; total: number };
  needFollowUp: { items: NeedFollowUpItem[]; total: number };
}

@Injectable()
export class NeedsActionService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
  ) {}

  async getNeedsAction(): Promise<NeedsActionResponse> {
    const [membershipEnding, idlePets, needFollowUp] = await Promise.all([
      this.getMembershipEnding(),
      this.getIdlePets(),
      this.getNeedFollowUp(),
    ]);

    return { membershipEnding, idlePets, needFollowUp };
  }

  private async getMembershipEnding() {
    const today = startOfDay(new Date());
    const lastDay = endOfMonth(today);

    const rows = await this.petMembershipModel
      .find({
        end_date: { $gte: today, $lte: lastDay },
        is_active: true,
        isDeleted: { $ne: true },
      })
      .sort({ end_date: 1 })
      .populate({
        path: 'pet',
        select: 'name customer_id',
        populate: { path: 'owner', select: 'username profile.full_name' },
      })
      .populate({ path: 'membership', select: 'name' })
      .lean<any[]>()
      .exec();

    const items: MembershipEndingItem[] = rows
      .filter((r) => r.pet)
      .map((r) => {
        const daysRemaining = diffInDays(today, new Date(r.end_date));
        const owner = r.pet?.owner;
        return {
          pet_id: String(r.pet?._id ?? ''),
          pet_name: r.pet?.name ?? '-',
          customer_name:
            owner?.profile?.full_name || owner?.username || 'Unknown',
          tier: r.membership?.name ?? '-',
          expiry_date: new Date(r.end_date).toISOString(),
          days_remaining: daysRemaining,
          urgency: daysRemaining <= 7 ? 'critical' : 'upcoming',
        };
      });

    return { items, total: items.length };
  }

  private async getIdlePets() {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await this.petModel
      .find({
        last_visit_at: { $ne: null, $lt: thirtyDaysAgo },
        is_active: true,
        isDeleted: { $ne: true },
      })
      .sort({ last_visit_at: 1 })
      .populate({ path: 'owner', select: 'username profile.full_name' })
      .populate({ path: 'breed', select: 'name' })
      .lean<any[]>()
      .exec();

    const items: IdlePetItem[] = rows.map((p) => {
      const lastVisit = new Date(p.last_visit_at);
      return {
        pet_id: String(p._id),
        pet_name: p.name,
        breed: p.breed?.name ?? null,
        customer_name:
          p.owner?.profile?.full_name || p.owner?.username || 'Unknown',
        last_visit_at: lastVisit.toISOString(),
        days_since: diffInDays(lastVisit, new Date()),
      };
    });

    return { items, total: items.length };
  }

  private async getNeedFollowUp() {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const rows = await this.bookingModel
      .aggregate([
        {
          $match: {
            booking_status: 'completed',
            isDeleted: { $ne: true },
          },
        },
        withEffectiveCompletedAt(),
        {
          $match: {
            [EFFECTIVE_COMPLETED_AT_FIELD]: { $gte: since },
          },
        },
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
                    $lte: [`$${EFFECTIVE_COMPLETED_AT_FIELD}`, '$$completedAt'],
                  },
                },
              },
              { $count: 'total' },
            ],
            as: 'visit_counter',
          },
        },
        {
          $addFields: {
            total_visits: {
              $ifNull: [{ $arrayElemAt: ['$visit_counter.total', 0] }, 0],
            },
          },
        },
        { $match: { total_visits: { $in: [1, 2] } } },
        {
          $lookup: {
            from: 'users',
            localField: 'customer_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        { $sort: { [EFFECTIVE_COMPLETED_AT_FIELD]: -1 } },
      ])
      .exec();

    const groomerIds = new Set<string>();
    for (const row of rows) {
      const session = pickPrimarySession(row.sessions);
      if (session?.groomer_id) groomerIds.add(String(session.groomer_id));
    }

    const groomers = groomerIds.size
      ? await this.bookingModel.db
          .collection('users')
          .find({
            _id: {
              $in: Array.from(groomerIds).map((id) => new Types.ObjectId(id)),
            },
          })
          .project({ username: 1, 'profile.full_name': 1 })
          .toArray()
      : [];

    const groomerById = new Map<string, string>();
    for (const g of groomers) {
      groomerById.set(
        String(g._id),
        g.profile?.full_name || g.username || 'Unknown',
      );
    }

    const items: NeedFollowUpItem[] = rows.map((row: any) => {
      const session = pickPrimarySession(row.sessions);
      const groomerId = session?.groomer_id
        ? String(session.groomer_id)
        : null;
      const customer = row.customer;
      return {
        booking_id: String(row._id),
        pet_id: String(row.pet_id),
        pet_name: row.pet_snapshot?.name ?? '-',
        customer_name:
          customer?.profile?.full_name || customer?.username || 'Unknown',
        visit_tag: row.total_visits === 1 ? '1st' : '2nd',
        service_name: row.service_snapshot?.name ?? '-',
        groomer_name: groomerId ? (groomerById.get(groomerId) ?? null) : null,
        completed_at: new Date(
          row[EFFECTIVE_COMPLETED_AT_FIELD] ?? row.completed_at,
        ).toISOString(),
      };
    });

    return { items, total: items.length };
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function diffInDays(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function pickPrimarySession(sessions: any[] | undefined) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const finished = sessions
    .filter((s) => s?.finished_at)
    .sort(
      (a, b) =>
        new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime(),
    );
  return finished[0] ?? sessions[0];
}
