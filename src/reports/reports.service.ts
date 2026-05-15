import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable, Subscriber } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageDocument,
} from 'src/booking/entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from 'src/pet-membership/entities/pet-membership.entity';
import { Membership, MembershipDocument } from 'src/membership/entities/membership.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { FinancialReportDto } from './dto/financial-report.dto';
import { OperationsReportDto } from './dto/operations-report.dto';
import { CapacityUtilisationReportDto } from './dto/capacity-utilisation-report.dto';
import { CustomerReportDto } from './dto/customer-report.dto';
import { BookingEventsService } from 'src/booking-events/booking-events.service';

const STREAM_CHUNK_SIZE = 50;

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(StoreDailyUsage.name)
    private readonly storeDailyUsageModel: Model<StoreDailyUsageDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,
    @InjectModel(PetMembership.name)
    private readonly petMembershipModel: Model<PetMembershipDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly bookingEventsService: BookingEventsService,
  ) {}

  private buildFilter(dto: FinancialReportDto): Record<string, any> {
    const filter: Record<string, any> = { isDeleted: false };

    if (dto.booking_status) filter.booking_status = dto.booking_status;

    if (dto.date_from || dto.date_to) {
      filter.date = {};
      if (dto.date_from) filter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) filter.date.$lte = new Date(dto.date_to);
    }

    if (dto.store_id) {
      try {
        const oid = new Types.ObjectId(dto.store_id);
        filter.store_id = { $in: [oid, dto.store_id] };
      } catch {
        filter.store_id = dto.store_id;
      }
    }

    if (dto.booking_type) filter.type = dto.booking_type;

    return filter;
  }

  async getFinancialReport(dto: FinancialReportDto) {
    const filter = this.buildFilter(dto);
    const limit = Math.min(dto.limit ?? 10000, 50000);

    const bookings = await this.bookingModel
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('customer', 'code username email phone_number')
      .populate('store', 'code name')
      .populate('pet', 'code')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username',
        model: 'User',
      })
      .exec();

    const plain = bookings.map((b) =>
      (b as any).toJSON ? (b as any).toJSON() : b,
    );

    return { bookings: plain, total: plain.length };
  }

  streamFinancialReport(dto: FinancialReportDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;

      this.getFinancialReport(dto)
        .then(async ({ bookings }) => {
          for (let i = 0; i < bookings.length; i += STREAM_CHUNK_SIZE) {
            if (cancelled) break;
            subscriber.next({
              data: JSON.stringify({ bookings: bookings.slice(i, i + STREAM_CHUNK_SIZE) }),
              type: 'chunk',
            } as MessageEvent);
            await new Promise<void>((resolve) => setImmediate(resolve));
          }
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ total: bookings.length }),
              type: 'done',
            } as MessageEvent);
            subscriber.complete();
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ message: err.message }),
              type: 'error',
            } as MessageEvent);
            subscriber.error(err);
          }
        });

      return () => {
        cancelled = true;
      };
    });
  }

  // ─── Operations: Booking & Ops Detail ────────────────────────────────────────

  private buildOperationsFilter(dto: OperationsReportDto): Record<string, any> {
    const filter: Record<string, any> = { isDeleted: false };

    if (dto.booking_status) filter.booking_status = dto.booking_status;

    if (dto.date_from || dto.date_to) {
      filter.date = {};
      if (dto.date_from) filter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) filter.date.$lte = new Date(dto.date_to);
    }

    if (dto.store_id) {
      try {
        const oid = new Types.ObjectId(dto.store_id);
        filter.store_id = { $in: [oid, dto.store_id] };
      } catch {
        filter.store_id = dto.store_id;
      }
    }

    if (dto.booking_type) filter.type = dto.booking_type;

    if (dto.session_status) filter['sessions.status'] = dto.session_status;

    if (dto.service_type) {
      filter['service_snapshot.service_type.title'] = {
        $regex: new RegExp(`^${dto.service_type}$`, 'i'),
      };
    }

    return filter;
  }

  async getOperationsReport(dto: OperationsReportDto) {
    const filter = this.buildOperationsFilter(dto);
    const limit = Math.min(dto.limit ?? 10000, 50000);

    const bookings = await this.bookingModel
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('customer', 'code username email phone_number')
      .populate('store', 'code name')
      .populate('pet', 'code')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username',
        model: 'User',
      })
      .exec();

    const plain = bookings.map((b) =>
      (b as any).toJSON ? (b as any).toJSON() : b,
    );

    return { bookings: plain, total: plain.length };
  }

  streamOperationsReport(dto: OperationsReportDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;

      this.getOperationsReport(dto)
        .then(async ({ bookings }) => {
          for (let i = 0; i < bookings.length; i += STREAM_CHUNK_SIZE) {
            if (cancelled) break;
            subscriber.next({
              data: JSON.stringify({ bookings: bookings.slice(i, i + STREAM_CHUNK_SIZE) }),
              type: 'chunk',
            } as MessageEvent);
            await new Promise<void>((resolve) => setImmediate(resolve));
          }
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ total: bookings.length }),
              type: 'done',
            } as MessageEvent);
            subscriber.complete();
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            subscriber.next({
              data: JSON.stringify({ message: err.message }),
              type: 'error',
            } as MessageEvent);
            subscriber.error(err);
          }
        });

      return () => {
        cancelled = true;
      };
    });
  }

  // ─── Capacity Utilisation Report ─────────────────────────────────────────────

  async getCapacityUtilisationReport(dto: CapacityUtilisationReportDto) {
    // 1. Build usage filter
    const usageFilter: Record<string, any> = {};
    if (dto.store_id) {
      try {
        usageFilter.store_id = new Types.ObjectId(dto.store_id);
      } catch {
        usageFilter.store_id = dto.store_id;
      }
    }
    if (dto.date_from || dto.date_to) {
      usageFilter.date = {};
      if (dto.date_from) usageFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        // Include the full end date
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        usageFilter.date.$lte = end;
      }
    }

    // 2. Fetch StoreDailyUsage records sorted newest first
    const usages = await this.storeDailyUsageModel
      .find(usageFilter)
      .sort({ date: -1, store_id: 1 })
      .exec();

    if (usages.length === 0) return { count: 0, data: [] };

    // 3. Collect unique store IDs
    const storeObjectIds = [
      ...new Set(usages.map((u) => u.store_id.toString())),
    ].map((id) => new Types.ObjectId(id));

    // 4. Fetch stores in a single query
    const stores = await this.storeModel
      .find({ _id: { $in: storeObjectIds } })
      .select('code name capacity')
      .exec();

    const storeMap = new Map(
      stores.map((s) => [s._id.toString(), s]),
    );

    // 5. Fetch all capacity overrides for the covered date range
    const capFilter: Record<string, any> = {
      store_id: { $in: storeObjectIds },
    };
    if (dto.date_from || dto.date_to) {
      capFilter.date = {};
      if (dto.date_from) capFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        capFilter.date.$lte = end;
      }
    }

    const capacities = await this.storeDailyCapacityModel
      .find(capFilter)
      .exec();

    // Key: `storeId-YYYY-MM-DD`
    const capMap = new Map(
      capacities.map((c) => [
        `${c.store_id.toString()}-${c.date.toISOString().slice(0, 10)}`,
        c,
      ]),
    );

    // 6. Count bookings per store+date via aggregation
    const bookingFilter: Record<string, any> = { isDeleted: false };
    if (dto.store_id) {
      try {
        bookingFilter.store_id = new Types.ObjectId(dto.store_id);
      } catch {
        bookingFilter.store_id = dto.store_id;
      }
    }
    if (dto.date_from || dto.date_to) {
      bookingFilter.date = {};
      if (dto.date_from) bookingFilter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) {
        const end = new Date(dto.date_to);
        end.setHours(23, 59, 59, 999);
        bookingFilter.date.$lte = end;
      }
    }

    const bookingCounts: { _id: { store_id: Types.ObjectId; date: string }; count: number }[] =
      await this.bookingModel.aggregate([
        { $match: bookingFilter },
        {
          $group: {
            _id: {
              store_id: '$store_id',
              date: {
                $dateToString: { format: '%Y-%m-%d', date: '$date' },
              },
            },
            count: { $sum: 1 },
          },
        },
      ]);

    const bookingCountMap = new Map(
      bookingCounts.map((b) => [
        `${b._id.store_id.toString()}-${b._id.date}`,
        b.count,
      ]),
    );

    // 7. Deduplikasi: jika ada beberapa record StoreDailyUsage untuk store+hari
    //    yang sama (beda time component), gabung used_minutes-nya
    const usageByKey = new Map<string, { store_id: typeof usages[0]['store_id']; date: Date; used_minutes: number }>();
    for (const u of usages) {
      const key = `${u.store_id.toString()}-${u.date.toISOString().slice(0, 10)}`;
      const existing = usageByKey.get(key);
      if (existing) {
        existing.used_minutes += u.used_minutes;
      } else {
        usageByKey.set(key, {
          store_id: u.store_id,
          date: u.date,
          used_minutes: u.used_minutes,
        });
      }
    }
    const deduplicatedUsages = Array.from(usageByKey.values());

    // 8. Build enriched rows
    const data = deduplicatedUsages.map((u) => {
      const storeId = u.store_id.toString();
      const dateStr = u.date.toISOString().slice(0, 10);
      const store = storeMap.get(storeId);

      const defaultCap =
        store?.capacity?.default_daily_capacity_minutes ?? 960;
      const overbookingLimit =
        store?.capacity?.overbooking_limit_minutes ?? 120;

      const capOverride = capMap.get(`${storeId}-${dateStr}`);
      const hasOverride = !!capOverride;
      const effectiveCap = hasOverride
        ? capOverride!.total_capacity_minutes
        : defaultCap;

      const usedMins = u.used_minutes;
      const utilisationPct =
        effectiveCap > 0
          ? Math.round((usedMins / effectiveCap) * 10000) / 100
          : 0;
      const remainingMins = Math.max(0, effectiveCap - usedMins);
      const isOverbooked = usedMins > effectiveCap;

      return {
        store_id: storeId,
        store_code: store?.code ?? '',
        store_name: store?.name ?? '',
        date: dateStr,
        default_capacity_mins: defaultCap,
        daily_override_mins: hasOverride
          ? capOverride!.total_capacity_minutes
          : null,
        effective_capacity_mins: effectiveCap,
        used_minutes: usedMins,
        utilisation_pct: utilisationPct,
        remaining_minutes: remainingMins,
        total_bookings: bookingCountMap.get(`${storeId}-${dateStr}`) ?? 0,
        overbooking_limit_mins: overbookingLimit,
        is_overbooked: isOverbooked,
        has_capacity_override: hasOverride,
        capacity_notes: capOverride?.notes ?? null,
      };
    });

    return { count: data.length, data };
  }

  // ─── Capacity Utilisation SSE stream ─────────────────────────────────────────

  private async getCapacityRowForStoreDate(storeId: string, dateStr: string, exactDate?: Date) {
    const storeOid = new Types.ObjectId(storeId);
    const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999Z`);

    // Try exact date match first (most reliable), fall back to day range
    let usage = exactDate
      ? await this.storeDailyUsageModel.findOne({ store_id: storeOid, date: exactDate }).exec()
      : null;
    if (!usage) {
      usage = await this.storeDailyUsageModel
        .findOne({ store_id: storeOid, date: { $gte: dateStart, $lte: dateEnd } })
        .exec();
    }

    const [store, capOverride, totalBookings] = await Promise.all([
      this.storeModel.findById(storeOid).select('code name capacity').exec(),
      this.storeDailyCapacityModel
        .findOne({ store_id: storeOid, date: { $gte: dateStart, $lte: dateEnd } })
        .exec(),
      this.bookingModel.countDocuments({
        store_id: storeOid,
        date: { $gte: dateStart, $lte: dateEnd },
        isDeleted: false,
      }),
    ]);

    if (!usage) {
      console.warn(`[cap-sse] StoreDailyUsage not found for store=${storeId} date=${dateStr}`);
      return null;
    }

    const defaultCap = store?.capacity?.default_daily_capacity_minutes ?? 960;
    const overbookingLimit = store?.capacity?.overbooking_limit_minutes ?? 120;
    const hasOverride = !!capOverride;
    const effectiveCap = hasOverride ? capOverride!.total_capacity_minutes : defaultCap;
    const usedMins = usage.used_minutes;
    const utilisationPct =
      effectiveCap > 0 ? Math.round((usedMins / effectiveCap) * 10000) / 100 : 0;

    return {
      store_id: storeId,
      store_code: store?.code ?? '',
      store_name: store?.name ?? '',
      date: dateStr,
      default_capacity_mins: defaultCap,
      daily_override_mins: hasOverride ? capOverride!.total_capacity_minutes : null,
      effective_capacity_mins: effectiveCap,
      used_minutes: usedMins,
      utilisation_pct: utilisationPct,
      remaining_minutes: Math.max(0, effectiveCap - usedMins),
      total_bookings: totalBookings,
      overbooking_limit_mins: overbookingLimit,
      is_overbooked: usedMins > effectiveCap,
      has_capacity_override: hasOverride,
      capacity_notes: capOverride?.notes ?? null,
    };
  }

  streamCapacityUtilisationReport(
    dto: CapacityUtilisationReportDto,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      let cancelled = false;
      // Key: "storeId-dateStr" → serialised row for change-detection
      const lastSeen = new Map<string, string>();

      const fetchAndPush = async (isInitial: boolean) => {
        if (cancelled) return;
        try {
          const { data } = await this.getCapacityUtilisationReport(dto);
          if (cancelled) return;

          if (isInitial) {
            subscriber.next({
              data: JSON.stringify({ rows: data }),
              type: 'snapshot',
            } as MessageEvent);
            for (const row of data) {
              lastSeen.set(`${row.store_id}-${row.date}`, JSON.stringify(row));
            }
          } else {
            // Push only rows that are new or have changed values
            for (const row of data) {
              const key = `${row.store_id}-${row.date}`;
              const serialised = JSON.stringify(row);
              if (lastSeen.get(key) !== serialised) {
                subscriber.next({
                  data: JSON.stringify({ row }),
                  type: 'update',
                } as MessageEvent);
                console.log(`[cap-sse] update sent: store=${row.store_id} date=${row.date} total_bookings=${row.total_bookings}`);
                lastSeen.set(key, serialised);
              }
            }
          }
        } catch (err) {
          console.error('[cap-sse] fetchAndPush error:', err);
        }
      };

      // Initial snapshot
      fetchAndPush(true).catch((err: Error) => {
        if (!cancelled) {
          subscriber.next({
            data: JSON.stringify({ message: err.message }),
            type: 'error',
          } as MessageEvent);
        }
      });

      // React immediately when any booking is created / updated
      const sub = this.bookingEventsService.bookingMutated$.subscribe(
        async (bookingId: string) => {
          console.log(`[cap-sse] mutation received bookingId=${bookingId} observers=${this.bookingEventsService.bookingMutated$.observers.length}`);
          if (cancelled) return;
          // Small delay so the write is visible to subsequent reads
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
          fetchAndPush(false);
        },
      );

      // Fallback poll — catches any events missed by the subscription
      const pollTimer = setInterval(() => fetchAndPush(false), 15_000);

      // Heartbeat — keeps the HTTP connection alive through proxies
      const heartbeatTimer = setInterval(() => {
        if (!cancelled) {
          subscriber.next({ data: '{}', type: 'ping' } as MessageEvent);
        }
      }, 20_000);

      return () => {
        cancelled = true;
        sub.unsubscribe();
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
      };
    });
  }

  streamLiveBookings(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      const sub = this.bookingEventsService.bookingMutated$.subscribe(
        async (bookingId: string) => {
          try {
            const booking = await this.bookingModel
              .findById(new Types.ObjectId(bookingId))
              .populate('customer', 'code username email phone_number')
              .populate('store', 'code name')
              .populate('pet', 'code')
              .populate({ path: 'sessions.groomer_id', select: 'username', model: 'User' })
              .exec();

            if (!booking || (booking as any).isDeleted) return;

            const plain = (booking as any).toJSON
              ? (booking as any).toJSON()
              : booking;

            subscriber.next({
              data: JSON.stringify({ booking: plain }),
              type: 'booking_changed',
            } as MessageEvent);
          } catch {
            // non-fatal — skip failed lookup
          }
        },
      );

      return () => sub.unsubscribe();
    });
  }

  // ─── Customer & Pet Master Data ───────────────────────────────────────────────

  async getCustomerMasterData(dto: CustomerReportDto) {
    const bookedPetIds = await this.bookingModel.distinct('pet_id', { isDeleted: false });
    const bookedPetSet = new Set(bookedPetIds.map((id: any) => id.toString()));

    const lastVisitAgg = await this.bookingModel.aggregate([
      { $match: { isDeleted: false, booking_status: 'completed' } },
      { $group: { _id: '$pet_id', last_at: { $max: '$date' } } },
    ]);
    const lastVisitMap = new Map<string, Date>(
      lastVisitAgg.map((a: any) => [a._id.toString(), a.last_at]),
    );

    const lastGroomingAgg = await this.bookingModel.aggregate([
      {
        $match: {
          isDeleted: false,
          booking_status: 'completed',
          'service_snapshot.service_type.title': { $regex: new RegExp('^grooming$', 'i') },
        },
      },
      { $group: { _id: '$pet_id', last_at: { $max: '$date' } } },
    ]);
    const lastGroomingMap = new Map<string, Date>(
      lastGroomingAgg.map((a: any) => [a._id.toString(), a.last_at]),
    );

    const pets = await this.petModel
      .find({ isDeleted: false })
      .populate('pet_type')
      .populate('hair')
      .populate('size')
      .populate('breed')
      .sort({ createdAt: -1 })
      .exec();

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .populate({ path: 'profile.customer_category_id', model: 'Option', select: 'name' })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const petIds = pets.map((p) => p._id);
    const memberships = await this.petMembershipModel
      .find({ pet_id: { $in: petIds }, isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership', select: 'name' })
      .sort({ start_date: -1 })
      .exec();
    const membershipMap = new Map<string, any>();
    for (const m of memberships) {
      const key = m.pet_id.toString();
      if (!membershipMap.has(key)) membershipMap.set(key, m);
    }

    const today = new Date();
    const rows = pets.map((pet) => {
      const p = (pet as any).toObject({ virtuals: true });
      const owner = userMap.get(p.customer_id?.toString());
      const ow = owner ? (owner as any).toObject({ virtuals: true }) : null;
      const membership = membershipMap.get(pet._id.toString());

      const mainAddr =
        ow?.profile?.addresses?.find((a: any) => a.is_main_address) ??
        ow?.profile?.addresses?.[0] ??
        null;

      return {
        customer_id: ow?._id?.toString() ?? '',
        customer_code: ow?.code ?? '',
        customer_name: ow?.profile?.full_name ?? ow?.username ?? '',
        customer_phone: ow?.phone_number ?? '',
        customer_email: ow?.email ?? '',
        customer_category: (ow?.profile?.customer_category_id as any)?.name ?? '',
        customer_tags: ow?.profile?.tags ?? [],
        customer_address: mainAddr
          ? [mainAddr.street, mainAddr.district, mainAddr.city, mainAddr.province]
              .filter(Boolean)
              .join(', ')
          : '',
        registered_at: ow?.createdAt ?? null,
        pet_id: p._id?.toString() ?? '',
        pet_code: p.code ?? '',
        pet_name: p.name ?? '',
        pet_type: (p.pet_type as any)?.name ?? '',
        breed: (p.breed as any)?.name ?? '',
        size_category: (p.size as any)?.name ?? '',
        feather_type: (p.hair as any)?.name ?? '',
        birthday: p.birthday ?? null,
        weight: p.weight ?? null,
        pet_tags: p.tags ?? [],
        internal_note: p.internal_note ?? '',
        membership_tier: (membership?.membership_plan_id as any)?.name ?? '',
        membership_status: membership
          ? new Date(membership.end_date) >= today
            ? 'active'
            : 'expired'
          : '',
        membership_start: membership?.start_date ?? null,
        membership_expiry: membership?.end_date ?? null,
        last_visit_at: lastVisitMap.get(pet._id.toString()) ?? null,
        last_grooming_at: lastGroomingMap.get(pet._id.toString()) ?? null,
        pet_registered_at: p.createdAt ?? null,
        has_booked: bookedPetSet.has(pet._id.toString()),
      };
    });

    const filtered = dto.search
      ? (() => {
          const s = dto.search.toLowerCase();
          return rows.filter(
            (r) =>
              r.customer_name.toLowerCase().includes(s) ||
              r.customer_phone.includes(s) ||
              r.pet_name.toLowerCase().includes(s),
          );
        })()
      : rows;

    return { data: filtered, total: filtered.length };
  }

  // ─── Customer Retention / Insight ────────────────────────────────────────────

  async getCustomerRetentionReport(dto: CustomerReportDto) {
    const today = new Date();
    const currentYear = today.getFullYear();

    const bookedPetIds = await this.bookingModel.distinct('pet_id', { isDeleted: false });
    const bookedPetSet = new Set(bookedPetIds.map((id: any) => id.toString()));

    const lastVisitRetAgg = await this.bookingModel.aggregate([
      { $match: { isDeleted: false, booking_status: 'completed' } },
      { $group: { _id: '$pet_id', last_at: { $max: '$date' } } },
    ]);
    const lastVisitRetMap = new Map<string, Date>(
      lastVisitRetAgg.map((a: any) => [a._id.toString(), a.last_at]),
    );

    // Aggregate completed bookings by pet (for revenue & visit counts)
    const bookingAgg = await this.bookingModel.aggregate([
      { $match: { isDeleted: false, booking_status: 'completed' } },
      {
        $group: {
          _id: '$pet_id',
          first_booking_date: { $min: '$date' },
          total_visits: { $sum: 1 },
          total_visits_ytd: {
            $sum: { $cond: [{ $eq: [{ $year: '$date' }, currentYear] }, 1, 0] },
          },
          lifetime_revenue: { $sum: { $ifNull: ['$final_total_price', 0] } },
          lifetime_revenue_ytd: {
            $sum: {
              $cond: [
                { $eq: [{ $year: '$date' }, currentYear] },
                { $ifNull: ['$final_total_price', 0] },
                0,
              ],
            },
          },
          service_names: { $push: '$service_snapshot.name' },
        },
      },
    ]);

    const bookingMap = new Map<string, any>();
    for (const agg of bookingAgg) {
      const petId = agg._id?.toString();
      if (!petId) continue;

      const nameCounts: Record<string, number> = {};
      for (const name of agg.service_names ?? []) {
        if (name) nameCounts[name] = (nameCounts[name] ?? 0) + 1;
      }
      const favourite_service =
        Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

      const avg_visit_interval =
        agg.total_visits > 1
          ? Math.round(
              (new Date(agg.last_booking_date).getTime() -
                new Date(agg.first_booking_date).getTime()) /
                (1000 * 60 * 60 * 24) /
                (agg.total_visits - 1),
            )
          : null;

      bookingMap.set(petId, {
        first_booking_date: agg.first_booking_date,
        total_visits: agg.total_visits,
        total_visits_ytd: agg.total_visits_ytd,
        lifetime_revenue: agg.lifetime_revenue,
        lifetime_revenue_ytd: agg.lifetime_revenue_ytd,
        favourite_service,
        avg_visit_interval,
      });
    }

    const pets = await this.petModel
      .find({ isDeleted: false })
      .populate('breed')
      .populate('pet_type')
      .sort({ createdAt: -1 })
      .exec();

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .populate({ path: 'profile.customer_category_id', model: 'Option', select: 'name' })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const petIds = pets.map((p) => p._id);
    const memberships = await this.petMembershipModel
      .find({ pet_id: { $in: petIds }, isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership', select: 'name' })
      .sort({ start_date: -1 })
      .exec();
    const membershipMap = new Map<string, any>();
    for (const m of memberships) {
      const key = m.pet_id.toString();
      if (!membershipMap.has(key)) membershipMap.set(key, m);
    }

    const rows = pets.map((pet) => {
      const p = (pet as any).toObject({ virtuals: true });
      const owner = userMap.get(p.customer_id?.toString());
      const ow = owner ? (owner as any).toObject({ virtuals: true }) : null;
      const booking = bookingMap.get(pet._id.toString()) ?? null;
      const membership = membershipMap.get(pet._id.toString());

      const last_visit_at: Date | null = lastVisitRetMap.get(pet._id.toString()) ?? null;
      const total_visits: number = booking?.total_visits ?? 0;
      const days_since_last_visit =
        last_visit_at != null
          ? Math.floor(
              (today.getTime() - new Date(last_visit_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

      let pet_status: string;
      if (total_visits === 0) {
        pet_status = 'idle';
      } else if (
        booking?.first_booking_date &&
        new Date(booking.first_booking_date) >=
          new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
      ) {
        pet_status = 'new';
      } else if (days_since_last_visit !== null && days_since_last_visit <= 14) {
        pet_status = 'active';
      } else if (days_since_last_visit !== null && days_since_last_visit <= 30) {
        pet_status = 'at_risk';
      } else {
        pet_status = 'lapsed';
      }

      return {
        customer_id: ow?._id?.toString() ?? '',
        customer_name: ow?.profile?.full_name ?? ow?.username ?? '',
        customer_phone: ow?.phone_number ?? '',
        customer_category: (ow?.profile?.customer_category_id as any)?.name ?? '',
        pet_id: p._id?.toString() ?? '',
        pet_name: p.name ?? '',
        pet_type: (p.pet_type as any)?.name ?? '',
        breed: (p.breed as any)?.name ?? '',
        membership_tier: (membership?.membership_plan_id as any)?.name ?? '',
        first_booking_date: booking?.first_booking_date ?? null,
        last_booking_date: last_visit_at,
        days_since_last_visit,
        total_visits,
        total_visits_ytd: booking?.total_visits_ytd ?? 0,
        avg_visit_interval: booking?.avg_visit_interval ?? null,
        lifetime_revenue: booking?.lifetime_revenue ?? 0,
        lifetime_revenue_ytd: booking?.lifetime_revenue_ytd ?? 0,
        favourite_service: booking?.favourite_service ?? '',
        pet_status,
        has_booked: bookedPetSet.has(pet._id.toString()),
      };
    });

    const filtered = dto.search
      ? (() => {
          const s = dto.search.toLowerCase();
          return rows.filter(
            (r) =>
              r.customer_name.toLowerCase().includes(s) ||
              r.customer_phone.includes(s) ||
              r.pet_name.toLowerCase().includes(s),
          );
        })()
      : rows;

    return { data: filtered, total: filtered.length };
  }
}
