import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from 'src/pet-membership/entities/pet-membership.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { resolveCompletedAt } from '../utils/completed-at';

export type ActivityEventType =
  | 'booking_completed'
  | 'booking_new'
  | 'booking_cancelled'
  | 'membership_purchased'
  | 'membership_expired'
  | 'customer_registered';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  title: string;
  subtitle: string;
  store_id?: string | null;
  amount?: number | null;
  is_early_renewal?: boolean;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
}

interface ActivityQueryArgs {
  storeId?: string;
  limit?: number;
}

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getActivity(args: ActivityQueryArgs): Promise<ActivityFeedResponse> {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const storeMatch: Record<string, any> = {};
    if (args.storeId && args.storeId !== 'all') {
      if (!Types.ObjectId.isValid(args.storeId)) {
        return { events: [] };
      }
      storeMatch.store_id = new Types.ObjectId(args.storeId);
    }

    const fetchSize = limit * 2;

    const [bookings, memberships, customers] = await Promise.all([
      this.bookingModel
        .find({ ...storeMatch, isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(fetchSize)
        .populate({ path: 'customer', select: 'username profile.full_name' })
        .lean<any[]>()
        .exec(),
      this.petMembershipModel
        .find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(fetchSize)
        .populate({ path: 'pet', select: 'name customer_id' })
        .populate({ path: 'membership', select: 'name' })
        .lean<any[]>()
        .exec(),
      this.userModel
        .find({ role: 'customer' })
        .sort({ createdAt: -1 })
        .limit(fetchSize)
        .select('username profile.full_name createdAt')
        .lean<any[]>()
        .exec(),
    ]);

    const events: ActivityEvent[] = [];

    for (const b of bookings) {
      const customerName =
        b.customer?.profile?.full_name || b.customer?.username || 'Customer';
      const petName = b.pet_snapshot?.name ?? 'Pet';
      const serviceName = b.service_snapshot?.name ?? 'Layanan';
      const storeId = b.store_id ? String(b.store_id) : null;

      const completedAt =
        b.booking_status === 'completed' ? resolveCompletedAt(b) : null;
      if (completedAt) {
        events.push({
          id: `booking-completed-${b._id}`,
          type: 'booking_completed',
          timestamp: completedAt.toISOString(),
          title: `Booking selesai · ${petName}`,
          subtitle: `${customerName} · ${serviceName}`,
          store_id: storeId,
          amount: b.final_total_price ?? null,
        });
      } else if (b.booking_status === 'cancelled') {
        events.push({
          id: `booking-cancelled-${b._id}`,
          type: 'booking_cancelled',
          timestamp: new Date(b.updatedAt).toISOString(),
          title: `Booking dibatalkan · ${petName}`,
          subtitle: `${customerName} · ${serviceName}`,
          store_id: storeId,
          amount: null,
        });
      } else {
        events.push({
          id: `booking-new-${b._id}`,
          type: 'booking_new',
          timestamp: new Date(b.createdAt).toISOString(),
          title: `Booking baru · ${petName}`,
          subtitle: `${customerName} · ${serviceName}`,
          store_id: storeId,
          amount: b.final_total_price ?? null,
        });
      }
    }

    // Build map: pet_id -> previous (older) membership end_date untuk deteksi early renewal
    const petIds = Array.from(
      new Set(memberships.map((m) => String(m.pet_id))),
    );
    const earliestPurchaseByPet = new Map<string, Date>();
    for (const m of memberships) {
      const key = String(m.pet_id);
      const t = new Date(m.createdAt).getTime();
      const existing = earliestPurchaseByPet.get(key);
      if (!existing || t < existing.getTime()) {
        earliestPurchaseByPet.set(key, new Date(m.createdAt));
      }
    }

    const priorMemberships = petIds.length
      ? await this.petMembershipModel
          .find({
            pet_id: { $in: petIds.map((id) => new Types.ObjectId(id)) },
            isDeleted: { $ne: true },
          })
          .select('pet_id end_date createdAt')
          .lean<any[]>()
          .exec()
      : [];

    // Untuk tiap (pet, current_membership), cari prev membership dengan createdAt < current.createdAt
    // dan ambil end_date prev terkini. Bila current.createdAt < prev.end_date → early renewal.
    function findPreviousEnd(petId: string, currentCreatedAt: Date): Date | null {
      let best: Date | null = null;
      let bestPrevCreated: number = -Infinity;
      for (const p of priorMemberships) {
        if (String(p.pet_id) !== petId) continue;
        const prevCreated = new Date(p.createdAt).getTime();
        if (prevCreated >= currentCreatedAt.getTime()) continue;
        if (prevCreated > bestPrevCreated) {
          bestPrevCreated = prevCreated;
          best = p.end_date ? new Date(p.end_date) : null;
        }
      }
      return best;
    }

    for (const m of memberships) {
      const petName = m.pet?.name ?? 'Pet';
      const tier = m.membership?.name ?? 'Membership';
      const created = new Date(m.createdAt);
      const prevEnd = findPreviousEnd(String(m.pet_id), created);
      const isEarlyRenewal = prevEnd
        ? created.getTime() < prevEnd.getTime()
        : false;

      events.push({
        id: `membership-purchased-${m._id}`,
        type: 'membership_purchased',
        timestamp: created.toISOString(),
        title: `Membership dibeli · ${petName}`,
        subtitle: `${tier}`,
        amount: m.purchase_price ?? null,
        is_early_renewal: isEarlyRenewal,
      });

      if (m.end_date && new Date(m.end_date).getTime() < Date.now()) {
        events.push({
          id: `membership-expired-${m._id}`,
          type: 'membership_expired',
          timestamp: new Date(m.end_date).toISOString(),
          title: `Membership berakhir · ${petName}`,
          subtitle: `${tier}`,
          amount: null,
        });
      }
    }

    for (const c of customers) {
      events.push({
        id: `customer-registered-${c._id}`,
        type: 'customer_registered',
        timestamp: new Date(c.createdAt).toISOString(),
        title: `Customer baru terdaftar`,
        subtitle: c.profile?.full_name || c.username || 'Unknown',
        amount: null,
      });
    }

    events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return { events: events.slice(0, limit) };
  }
}
