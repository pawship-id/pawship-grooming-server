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
import {
  BenefitUsage,
  BenefitUsageDocument,
} from 'src/benefit-usage/entities/benefit-usage.entity';
import { Service, ServiceDocument } from 'src/service/entities/service.entity';
import { toUtcStartOfDay } from 'src/dashboard/utils/date-range';
import {
  MembershipLog,
  MembershipLogDocument,
  MembershipEventType,
} from 'src/pet-membership/entities/membership-log.entity';
import { FinancialReportDto } from './dto/financial-report.dto';
import { OperationsReportDto } from './dto/operations-report.dto';
import { CapacityUtilisationReportDto } from './dto/capacity-utilisation-report.dto';
import { CustomerReportDto } from './dto/customer-report.dto';
import { MembershipRevenueReportDto } from './dto/membership-revenue-report.dto';
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
    @InjectModel(BenefitUsage.name)
    private readonly benefitUsageModel: Model<BenefitUsageDocument>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(MembershipLog.name)
    private readonly membershipLogModel: Model<MembershipLogDocument>,
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
          ? new Date(membership.end_date) >= toUtcStartOfDay(today)
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

      const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      let pet_status: string;
      if (total_visits === 0) {
        // Idle: registered but never booked
        pet_status = 'idle';
      } else if (
        booking?.first_booking_date &&
        new Date(booking.first_booking_date) >= fourteenDaysAgo
      ) {
        // New: first visit within last 14 days
        pet_status = 'new';
      } else if (days_since_last_visit !== null && days_since_last_visit <= 14) {
        // Active: returning customer, last visit ≤ 14 days ago (first_booking < 14d ago implicit)
        pet_status = 'active';
      } else if (
        total_visits > 1 &&
        days_since_last_visit !== null &&
        days_since_last_visit <= 30
      ) {
        // At risk: drifting, 15–30 days since last visit, more than 1 visit
        pet_status = 'at_risk';
      } else if (
        total_visits > 1 &&
        days_since_last_visit !== null &&
        days_since_last_visit > 30
      ) {
        // Lapsed: gone quiet, >30 days since last visit, more than 1 visit
        pet_status = 'lapsed';
      } else {
        // Single-visit customer beyond active window → treat as lapsed
        pet_status = 'lapsed';
      }

      return {
        customer_id: ow?._id?.toString() ?? '',
        customer_code: ow?.code ?? '',
        customer_name: ow?.profile?.full_name ?? ow?.username ?? '',
        customer_phone: ow?.phone_number ?? '',
        customer_category: (ow?.profile?.customer_category_id as any)?.name ?? '',
        pet_id: p._id?.toString() ?? '',
        pet_code: p.code ?? '',
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

  // ─── New Customer Conversion ──────────────────────────────────────────────────

  async getNewCustomerConversionReport(dto: CustomerReportDto) {
    const today = new Date();

    const bookedPetIds = await this.bookingModel.distinct('pet_id', {
      isDeleted: false,
      booking_status: 'completed',
    });
    const bookedPetSet = new Set(bookedPetIds.map((id: any) => id.toString()));

    const firstBookingAgg = await this.bookingModel.aggregate([
      { $match: { isDeleted: false, booking_status: 'completed' } },
      { $group: { _id: '$pet_id', first_booking_date: { $min: '$date' } } },
    ]);
    const firstBookingMap = new Map<string, Date>(
      firstBookingAgg.map((a: any) => [a._id.toString(), a.first_booking_date]),
    );

    const pets = await this.petModel
      .find({ isDeleted: false })
      .populate('pet_type')
      .sort({ createdAt: -1 })
      .exec();

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .populate({ path: 'profile.customer_category_id', model: 'Option', select: 'name' })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const rows = pets.map((pet) => {
      const p = (pet as any).toObject({ virtuals: true });
      const owner = userMap.get(p.customer_id?.toString());
      const ow = owner ? (owner as any).toObject({ virtuals: true }) : null;

      const pet_registered_at: Date = p.createdAt;
      const days_since_registered = Math.floor(
        (today.getTime() - new Date(pet_registered_at).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const first_booking_date = firstBookingMap.get(pet._id.toString()) ?? null;
      const days_to_first_booking =
        first_booking_date != null
          ? Math.floor(
              (new Date(first_booking_date).getTime() -
                new Date(pet_registered_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

      return {
        customer_id: ow?._id?.toString() ?? '',
        customer_code: ow?.code ?? '',
        customer_name: ow?.profile?.full_name ?? ow?.username ?? '',
        customer_phone: ow?.phone_number ?? '',
        customer_category: (ow?.profile?.customer_category_id as any)?.name ?? '',
        pet_id: p._id?.toString() ?? '',
        pet_code: p.code ?? '',
        pet_name: p.name ?? '',
        pet_type: (p.pet_type as any)?.name ?? '',
        pet_registered_at,
        days_since_registered,
        has_booked: bookedPetSet.has(pet._id.toString()),
        first_booking_date,
        days_to_first_booking,
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

  // ─── VIP / Top Customer ───────────────────────────────────────────────────────

  async getVipCustomerReport() {
    const today = new Date();

    const bookingAgg = await this.bookingModel.aggregate([
      { $match: { isDeleted: false, booking_status: 'completed' } },
      {
        $group: {
          _id: '$pet_id',
          last_booking_date: { $max: '$date' },
          first_booking_date: { $min: '$date' },
          total_visits: { $sum: 1 },
          lifetime_revenue: { $sum: { $ifNull: ['$final_total_price', 0] } },
        },
      },
      { $match: { total_visits: { $gte: 1 } } },
    ]);

    if (bookingAgg.length === 0) return { data: [], total: 0 };

    const bookingMap = new Map<string, any>();
    for (const agg of bookingAgg) {
      bookingMap.set(agg._id?.toString(), {
        last_booking_date: agg.last_booking_date,
        first_booking_date: agg.first_booking_date,
        total_visits: agg.total_visits,
        lifetime_revenue: agg.lifetime_revenue,
      });
    }

    const petIds = bookingAgg.map((a) => a._id).filter(Boolean);

    const pets = await this.petModel
      .find({ _id: { $in: petIds }, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .populate({ path: 'profile.customer_category_id', model: 'Option', select: 'name' })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Use pet._id from petModel (proper Mongoose ObjectIds) — same pattern as retention report
    const petDocIds = pets.map((p) => p._id);
    const memberships = await this.petMembershipModel
      .find({ pet_id: { $in: petDocIds }, isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership', select: 'name' })
      .sort({ start_date: -1 })
      .exec();
    const membershipMap = new Map<string, any>();
    for (const m of memberships) {
      const key = m.pet_id.toString();
      if (membershipMap.has(key)) continue;
      // Active = is_active tidak di-set false DAN end_date belum lewat
      // (inklusif sepanjang hari end_date — konsisten dengan status pet membership)
      const notExpired = m.end_date
        ? new Date(m.end_date) >= toUtcStartOfDay(today)
        : false;
      const notDeactivated = m.is_active !== false;
      if (notExpired && notDeactivated) membershipMap.set(key, m);
    }

    const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const rows = pets
      .map((pet) => {
        const p = (pet as any).toObject({ virtuals: true });
        const owner = userMap.get(p.customer_id?.toString());
        const ow = owner ? (owner as any).toObject({ virtuals: true }) : null;
        const booking = bookingMap.get(pet._id.toString());
        const membership = membershipMap.get(pet._id.toString());

        if (!booking) return null;

        const last_booking_date: Date | null = booking.last_booking_date ?? null;
        const total_visits: number = booking.total_visits ?? 0;
        const days_since_last_visit =
          last_booking_date != null
            ? Math.floor(
                (today.getTime() - new Date(last_booking_date).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;

        let pet_status: string;
        if (total_visits === 0) {
          pet_status = 'idle';
        } else if (
          booking.first_booking_date &&
          new Date(booking.first_booking_date) >= fourteenDaysAgo
        ) {
          pet_status = 'new';
        } else if (days_since_last_visit !== null && days_since_last_visit <= 14) {
          pet_status = 'active';
        } else if (total_visits > 1 && days_since_last_visit !== null && days_since_last_visit <= 30) {
          pet_status = 'at_risk';
        } else {
          pet_status = 'lapsed';
        }

        return {
          customer_id: ow?._id?.toString() ?? '',
          pet_id: p._id?.toString() ?? '',
          customer_name: ow?.profile?.full_name ?? ow?.username ?? '',
          customer_phone: ow?.phone_number ?? '',
          customer_category: (ow?.profile?.customer_category_id as any)?.name ?? '',
          pet_name: p.name ?? '',
          membership_tier: (membership?.membership_plan_id as any)?.name ?? '',
          total_visits,
          lifetime_revenue: booking.lifetime_revenue ?? 0,
          last_booking_date,
          days_since_last_visit,
          pet_status,
        };
      })
      .filter(Boolean);

    rows.sort((a: any, b: any) => b.lifetime_revenue - a.lifetime_revenue);

    return { data: rows, total: rows.length };
  }

  // ─── Membership Reports ───────────────────────────────────────────────────────

  // Mirrors PetMembershipService.computeStatus (the canonical source used by the
  // /admin/users/.../memberships reference page), but returns 'menunggu' instead of
  // 'pending' to match the membership report's status vocabulary.
  private membershipReportStatus(
    isActive: boolean,
    startDate: Date | null | undefined,
    endDate: Date | null | undefined,
    now: Date,
  ): 'active' | 'menunggu' | 'expired' | 'cancelled' {
    if (!isActive) return 'cancelled';
    if (startDate && now < new Date(startDate)) return 'menunggu';
    // expired hanya jika end_date sudah lewat sebelum hari ini
    // (inklusif sepanjang hari end_date — mirror PetMembershipService.computeStatus)
    if (endDate && new Date(endDate) < toUtcStartOfDay(now)) return 'expired';
    return 'active';
  }

  async getMembershipDetailReport() {
    const today = new Date();

    // Compute current period keys for weekly and monthly benefit resets
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isoDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayNum = isoDate.getUTCDay() || 7;
    isoDate.setUTCDate(isoDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(isoDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((isoDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const currentWeekKey = `${isoDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    // Fetch all purchased/renewed logs — used for renewal count, early renewal, previous plan.
    const allLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: { $in: [MembershipEventType.PURCHASED, MembershipEventType.RENEWED] },
      })
      .select('pet_id membership_plan_id pet_membership_id start_date end_date createdAt')
      .exec();

    // renewal_count dihitung per PET lintas semua plan. Setiap event purchase/renew
    // di plan apa pun menambah 1; -1 untuk initial purchase. Cancelled events
    // mengurangi 1 (purchase/renew yang dibatalkan tidak dihitung).
    const petLogCountMap = new Map<string, number>();
    const allLogsByPetMap = new Map<string, typeof allLogs>();
    const logsByPmMap = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      const petId = log.pet_id.toString();
      petLogCountMap.set(petId, (petLogCountMap.get(petId) ?? 0) + 1);
      if (!allLogsByPetMap.has(petId)) allLogsByPetMap.set(petId, []);
      allLogsByPetMap.get(petId)!.push(log);
      const pmId = log.pet_membership_id.toString();
      if (!logsByPmMap.has(pmId)) logsByPmMap.set(pmId, []);
      logsByPmMap.get(pmId)!.push(log);
    }

    // Cancelled logs mengurangi renewal_count per pet sebanyak 1 per cancel.
    const cancelledLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: MembershipEventType.CANCELLED,
      })
      .select('pet_id pet_membership_id event_date')
      .exec();
    const cancelledByPetMap = new Map<string, number>();
    // Earliest cancellation event_date per pet_membership_id — dipakai untuk
    // memotong periode aktif PM saat early-renewal check (PM yang sudah
    // dibatalkan tidak lagi "menghalangi" purchase/renew berikutnya).
    const cancelDateByPmMap = new Map<string, Date>();
    for (const log of cancelledLogs) {
      const petId = log.pet_id.toString();
      cancelledByPetMap.set(petId, (cancelledByPetMap.get(petId) ?? 0) + 1);
      const pmId = log.pet_membership_id?.toString();
      const evDate = (log as any).event_date
        ? new Date((log as any).event_date)
        : null;
      if (pmId && evDate) {
        const existing = cancelDateByPmMap.get(pmId);
        if (!existing || evDate < existing) cancelDateByPmMap.set(pmId, evDate);
      }
    }

    // Plan name map for all membership_plan_ids referenced in logs (for previous_plan lookup)
    const allLogPlanIds = [...new Set(allLogs.map((l) => l.membership_plan_id.toString()))];
    const logPlanDocs = await this.membershipModel
      .find({ _id: { $in: allLogPlanIds.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const logPlanNameMap = new Map(logPlanDocs.map((p) => [p._id.toString(), (p as any).name as string]));

    // 1 row per PetMembership — tidak ada grouping. Cancelled/expired tetap muncul,
    // kolom Status yang membedakannya.
    const allMemberships = await this.petMembershipModel
      .find({ isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership' })
      .sort({ createdAt: -1 })
      .exec();

    // is_early_renewal per PET (lintas semua plan): pet pernah purchase/renew
    // membership sementara ada membership lain dari pet yang sama masih dalam
    // periode aktif. Membership yang sudah dibatalkan TIDAK dihitung sebagai
    // "aktif" — periode aktifnya dipotong di tanggal cancellation. Jadi kalau
    // purchase/renew terjadi SEBELUM cancellation (saat lawan benar-benar
    // masih aktif), tetap dihitung sebagai early renewal.
    // Flag berlaku untuk SEMUA row pet ini.
    const earlyRenewalPetSet = new Set<string>();
    for (const [petId, petLogs] of allLogsByPetMap.entries()) {
      if (petLogs.length <= 1) continue;
      const hasEarlyRenewal = petLogs.some((log) => {
        const createdAt = (log as any).createdAt ? new Date((log as any).createdAt) : null;
        if (!createdAt) return false;
        return petLogs.some((other) => {
          if (other._id.toString() === log._id.toString()) return false;
          const otherStart = new Date(other.start_date);
          const otherEnd = new Date(other.end_date);
          const cancelDate = cancelDateByPmMap.get(
            other.pet_membership_id.toString(),
          );
          // Jika PM lain pernah dibatalkan, periode aktifnya berhenti di tanggal cancel.
          const effectiveEnd =
            cancelDate && cancelDate < otherEnd ? cancelDate : otherEnd;
          return createdAt >= otherStart && createdAt <= effectiveEnd;
        });
      });
      if (hasEarlyRenewal) earlyRenewalPetSet.add(petId);
    }

    // Fetch pets and users
    const petIds = [...new Set(allMemberships.map((m) => m.pet_id.toString()))];
    const pets = await this.petModel
      .find({ _id: { $in: petIds }, isDeleted: false })
      .populate('pet_type')
      .populate('breed')
      .exec();
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Aggregate total_sessions per pet_membership_id dari BenefitUsage (unique bookings)
    const benefitUsageAgg: { _id: Types.ObjectId; total_sessions: number }[] =
      await this.benefitUsageModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$pet_membership_id',
            booking_ids: { $addToSet: '$booking_id' },
          },
        },
        {
          $project: {
            _id: 1,
            total_sessions: { $size: '$booking_ids' },
          },
        },
      ]);
    const totalSessionsMap = new Map<string, number>();
    for (const agg of benefitUsageAgg) {
      totalSessionsMap.set(agg._id.toString(), agg.total_sessions);
    }

    // Aggregate total_amount_deducted per pet_membership_id dari Booking.applied_benefits
    // Unwind applied_benefits, filter yang punya pet_membership_id, group & sum amount_deducted
    const amountDeductedAgg: { _id: Types.ObjectId; total_amount: number }[] =
      await this.bookingModel.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: '$applied_benefits' },
        {
          $match: {
            'applied_benefits.pet_membership_id': { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$applied_benefits.pet_membership_id',
            total_amount: { $sum: '$applied_benefits.amount_deducted' },
          },
        },
      ]);
    const amountDeductedMap = new Map<string, number>();
    for (const agg of amountDeductedAgg) {
      amountDeductedMap.set(agg._id.toString(), agg.total_amount);
    }

    // Aggregate BenefitUsage per (pet_membership_id, benefit_id)
    // booking_id di-deduplicate dengan $addToSet sehingga 1 booking tetap dihitung 1
    // walaupun ada banyak record (misal: lebih dari 1 addon dalam 1 booking)
    const benefitUsagePerBenefitAgg: {
      _id: { pet_membership_id: Types.ObjectId; benefit_id: Types.ObjectId };
      amount_used: number;
    }[] = await this.benefitUsageModel.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: {
            pet_membership_id: '$pet_membership_id',
            benefit_id: '$benefit_id',
          },
          booking_ids: { $addToSet: '$booking_id' },
        },
      },
      {
        $project: {
          _id: 1,
          amount_used: { $size: '$booking_ids' },
        },
      },
    ]);
    // Map: pet_membership_id -> benefit_id -> used count (unique bookings)
    const benefitUsageByBenefitMap = new Map<string, Map<string, number>>();
    for (const agg of benefitUsagePerBenefitAgg) {
      const pmId = agg._id.pet_membership_id.toString();
      const bId = agg._id.benefit_id.toString();
      if (!benefitUsageByBenefitMap.has(pmId)) {
        benefitUsageByBenefitMap.set(pmId, new Map());
      }
      benefitUsageByBenefitMap.get(pmId)!.set(bId, agg.amount_used);
    }

    // Aggregate current-period usage per (pet_membership_id, benefit_id)
    // Monthly benefits → filter by currentMonthKey, weekly → currentWeekKey, unlimited → all records
    const currentPeriodUsageAgg: {
      _id: { pet_membership_id: Types.ObjectId; benefit_id: Types.ObjectId };
      current_period_used: number;
    }[] = await this.benefitUsageModel.aggregate([
      { $match: { isDeleted: false } },
      {
        $match: {
          $or: [
            { benefit_period: 'monthly', period_key: currentMonthKey },
            { benefit_period: 'weekly', period_key: currentWeekKey },
            { benefit_period: 'unlimited' },
          ],
        },
      },
      {
        $group: {
          _id: {
            pet_membership_id: '$pet_membership_id',
            benefit_id: '$benefit_id',
          },
          booking_ids: { $addToSet: '$booking_id' },
        },
      },
      {
        $project: {
          _id: 1,
          current_period_used: { $size: '$booking_ids' },
        },
      },
    ]);
    // Map: pet_membership_id -> benefit_id -> current period used count
    const currentPeriodUsageMap = new Map<string, Map<string, number>>();
    for (const agg of currentPeriodUsageAgg) {
      const pmId = agg._id.pet_membership_id.toString();
      const bId = agg._id.benefit_id.toString();
      if (!currentPeriodUsageMap.has(pmId)) currentPeriodUsageMap.set(pmId, new Map());
      currentPeriodUsageMap.get(pmId)!.set(bId, agg.current_period_used);
    }

    // Collect all service_ids referenced in benefits_snapshot across all memberships
    const allServiceIds = new Set<string>();
    for (const m of allMemberships) {
      const mObj = (m as any).toObject({ virtuals: true });
      for (const b of mObj.benefits_snapshot ?? []) {
        if (b.service_id) allServiceIds.add(b.service_id.toString());
      }
    }
    const services = allServiceIds.size > 0
      ? await this.serviceModel
          .find({ _id: { $in: [...allServiceIds].map((id) => new Types.ObjectId(id)) } })
          .select('name')
          .exec()
      : [];
    const serviceMap = new Map(services.map((s) => [s._id.toString(), s.name]));

    const rows = allMemberships.map((m) => {
      const mObj = (m as any).toObject({ virtuals: true });
      const plan = mObj.membership_plan_id as any;
      const pet = petMap.get(m.pet_id.toString());
      const pObj = pet ? (pet as any).toObject({ virtuals: true }) : null;
      const owner = pObj ? userMap.get(pObj.customer_id?.toString()) : null;
      const oObj = owner ? (owner as any).toObject({ virtuals: true }) : null;

      // previous_plan: the plan from the log just before the current membership's log (by createdAt)
      const petLogs = allLogsByPetMap.get(m.pet_id.toString()) ?? [];
      const sortedPetLogs = [...petLogs].sort(
        (a, b) => new Date((a as any).createdAt).getTime() - new Date((b as any).createdAt).getTime(),
      );
      const currentLogIdx = sortedPetLogs.findIndex(
        (l) => l.pet_membership_id.toString() === m._id.toString(),
      );
      const prevLog = currentLogIdx > 0 ? sortedPetLogs[currentLogIdx - 1] : null;
      const previous_plan = prevLog
        ? (logPlanNameMap.get(prevLog.membership_plan_id.toString()) ?? null)
        : null;

      // renewal_count = (total purchased+renewed events untuk pet ini lintas
      // semua plan) - 1 - cancelled events untuk pet ini.
      const petKey = m.pet_id.toString();
      const cancelledCount = cancelledByPetMap.get(petKey) ?? 0;
      const renewal_count = Math.max(
        0,
        (petLogCountMap.get(petKey) ?? 1) - 1 - cancelledCount,
      );

      const is_early_renewal = earlyRenewalPetSet.has(m.pet_id.toString());

      const endDate = m.end_date ? new Date(m.end_date) : null;
      const startDate = m.start_date ? new Date(m.start_date) : null;

      const duration_days =
        startDate && endDate
          ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
          : null;

      const membership_status = this.membershipReportStatus(
        m.is_active,
        m.start_date,
        m.end_date,
        today,
      );

      const days_until_expiry =
        membership_status === 'menunggu'
          ? duration_days
          : endDate
            ? Math.round((endDate.getTime() - today.getTime()) / 86400000)
            : null;

      // Full benefits snapshot array (one item per benefit)
      const usageForThisMembership = benefitUsageByBenefitMap.get(m._id.toString());
      const currentPeriodForThisMembership = currentPeriodUsageMap.get(m._id.toString());
      const benefits_snapshot = (mObj.benefits_snapshot ?? []).map((b) => {
        const limit = b.limit ?? null;
        const benefitId = b._id?.toString() ?? null;
        const used = benefitId ? (usageForThisMembership?.get(benefitId) ?? 0) : 0;
        const current_period_used = benefitId ? (currentPeriodForThisMembership?.get(benefitId) ?? 0) : 0;
        // remaining is based on current-period usage so it reflects the period limit correctly
        const remaining = limit !== null ? Math.max(0, limit - current_period_used) : null;
        const serviceId = b.service_id?.toString() ?? null;
        const name = (b.label ?? null) || (serviceId ? (serviceMap.get(serviceId) ?? null) : null);
        return {
          name,
          type: b.type ?? null,
          applies_to: b.applies_to ?? null,
          value: b.value ?? null,
          period: b.period ?? null,
          limit,
          used,
          current_period_used,
          remaining,
        };
      });

      // Benefit snapshot (first benefit — kept for backward compat)
      const b0 = benefits_snapshot[0] ?? null;
      const benefit_1_name = b0?.name ?? null;
      const benefit_1_type = b0?.type ?? null;
      const benefit_1_applies_to = b0?.applies_to ?? null;
      const benefit_1_value = b0?.value ?? null;
      const benefit_1_limit = b0?.limit ?? null;
      const benefit_1_used = b0?.used ?? null;
      const benefit_1_current_period_used = b0?.current_period_used ?? null;
      const benefit_1_remaining = b0?.remaining ?? null;

      // Benefit utilisation summary
      const membership_price = m.purchase_price ?? plan?.price ?? 0;
      const pmId = m._id.toString();
      const total_benefit_used_amount = amountDeductedMap.get(pmId) ?? 0;
      const total_sessions_using_benefit = totalSessionsMap.get(pmId) ?? 0;
      const benefit_roi =
        membership_price > 0
          ? Math.round((total_benefit_used_amount / membership_price) * 10000) / 100
          : 0;

      return {
        pet_membership_id: m._id.toString(),
        pet_id: m.pet_id.toString(),
        pet_code: pObj?.code ?? '',
        pet_name: pObj?.name ?? '',
        pet_type: (pObj?.pet_type as any)?.name ?? '',
        breed: (pObj?.breed as any)?.name ?? '',
        customer_id: pObj?.customer_id?.toString() ?? '',
        customer_code: oObj?.code ?? '',
        customer_name: oObj?.profile?.full_name ?? oObj?.username ?? '',
        customer_phone: oObj?.phone_number ?? '',
        order_number: m.order_number ?? '',
        membership_plan_id: plan?._id?.toString() ?? '',
        membership_code: plan?.code ?? '',
        membership_name: plan?.name ?? '',
        membership_price,
        duration_days,
        start_date: m.start_date ?? null,
        end_date: m.end_date ?? null,
        days_until_expiry,
        membership_status,
        is_early_renewal,
        renewal_count,
        previous_plan,
        benefits_snapshot,
        benefit_1_name,
        benefit_1_type,
        benefit_1_applies_to,
        benefit_1_value,
        benefit_1_limit,
        benefit_1_used,
        benefit_1_current_period_used,
        benefit_1_remaining,
        total_benefit_used_amount,
        total_sessions_using_benefit,
        benefit_roi,
        created_at: (m as any).createdAt ?? null,
        cancelled_at: cancelDateByPmMap.get(m._id.toString()) ?? null,
      };
    });

    // Sort: newest first by createdAt (descending)
    rows.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });

    return { data: rows, total: rows.length };
  }

  async getMembershipExpiryReport() {
    const today = new Date();
    const startOfToday = toUtcStartOfDay(today);
    const horizon = new Date(startOfToday);
    horizon.setUTCDate(horizon.getUTCDate() + 30);
    horizon.setUTCHours(23, 59, 59, 999);

    // Only memberships whose end_date falls within today..today+30d.
    const expiringMemberships = await this.petMembershipModel
      .find({
        isDeleted: false,
        end_date: { $gte: startOfToday, $lte: horizon },
      })
      .populate({ path: 'membership_plan_id', model: 'Membership' })
      .exec();

    if (expiringMemberships.length === 0) {
      return { data: [], total: 0 };
    }

    // renewal_count — formula sama dengan Membership Detail Report:
    //   max(0, (purchased+renewed events per pet lintas semua plan) - 1 - cancelled events per pet)
    const petIdsForLogs = expiringMemberships.map((m) => m.pet_id);

    const purchasedLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: {
          $in: [MembershipEventType.PURCHASED, MembershipEventType.RENEWED],
        },
        pet_id: { $in: petIdsForLogs },
      })
      .select('pet_id')
      .exec();

    const petLogCountMap = new Map<string, number>();
    for (const log of purchasedLogs) {
      const petId = log.pet_id.toString();
      petLogCountMap.set(petId, (petLogCountMap.get(petId) ?? 0) + 1);
    }

    const cancelledLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: MembershipEventType.CANCELLED,
        pet_id: { $in: petIdsForLogs },
      })
      .select('pet_id')
      .exec();

    const cancelledByPetMap = new Map<string, number>();
    for (const log of cancelledLogs) {
      const petId = log.pet_id.toString();
      cancelledByPetMap.set(petId, (cancelledByPetMap.get(petId) ?? 0) + 1);
    }

    const petIds = [...new Set(expiringMemberships.map((m) => m.pet_id.toString()))];
    const pets = await this.petModel
      .find({ _id: { $in: petIds }, isDeleted: false })
      .exec();
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // last_visit_at = booking dengan `date` paling baru per pet_id, dibatasi
    // hanya pada booking yang sudah benar-benar dilayani (booking_status
    // 'completed' atau 'returned'). Booking yang dibatalkan / belum jalan
    // tidak dihitung sebagai kunjungan.
    //
    // Tidak memfilter pet_id di $match (mengikuti pattern getCustomerRetention
    // & getCustomerMasterData) — sebagian booking lama menyimpan pet_id
    // sebagai string sehingga `{ $in: <ObjectId[]> }` dapat melewatkan match.
    // Pencocokan dilakukan setelah aggregation lewat .toString() pada map key.
    const lastVisitAgg: { _id: unknown; last_at: Date }[] =
      await this.bookingModel.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            booking_status: { $in: ['completed', 'returned'] },
          },
        },
        { $group: { _id: '$pet_id', last_at: { $max: '$date' } } },
      ]);
    const lastVisitMap = new Map<string, Date>(
      lastVisitAgg.map((a) => [String(a._id), a.last_at]),
    );

    // total_benefit_used = SUM(Booking.applied_benefits.amount_deducted) per
    // pet_membership_id. Sumber data disamakan dengan kolom "Total Nilai
    // Digunakan" di Membership Detail Report (lihat amountDeductedAgg di
    // getMembershipDetailReport) supaya angka konsisten antar laporan.
    //
    // Tidak memfilter pet_membership_id di $match — sebagian booking lama
    // menyimpan pet_membership_id sebagai string sehingga `{ $in: <ObjectId[]> }`
    // melewatkan match. Pencocokan dilakukan setelah aggregation lewat
    // .toString() pada map key (pola sama dengan lastVisitAgg di atas).
    const benefitAgg: { _id: unknown; total_amount: number }[] =
      await this.bookingModel.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: '$applied_benefits' },
        {
          $match: {
            'applied_benefits.pet_membership_id': { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$applied_benefits.pet_membership_id',
            total_amount: { $sum: '$applied_benefits.amount_deducted' },
          },
        },
      ]);
    const benefitUsedMap = new Map<string, number>(
      benefitAgg.map((a) => [String(a._id), a.total_amount]),
    );

    const rows = expiringMemberships.map((m) => {
      const mObj = (m as any).toObject({ virtuals: true });
      const plan = mObj.membership_plan_id as any;
      const pet = petMap.get(m.pet_id.toString());
      const pObj = pet ? (pet as any).toObject({ virtuals: true }) : null;
      const owner = pObj ? userMap.get(pObj.customer_id?.toString()) : null;
      const oObj = owner ? (owner as any).toObject({ virtuals: true }) : null;

      const endDate = m.end_date ? new Date(m.end_date) : null;
      // Hitung selisih hari kalender, bukan jam — normalisasi ke UTC midnight
      // supaya jam berjalan tidak menggeser hasil (mis. expiry besok jam 00 UTC
      // dari "sekarang" sore = 9 jam = 0.4 hari → Math.round-nya 0, harusnya 1).
      const days_until_expiry = endDate
        ? Math.floor(
            (toUtcStartOfDay(endDate).getTime() - startOfToday.getTime()) /
              86400000,
          )
        : 0;

      const last_visit_at = lastVisitMap.get(m.pet_id.toString()) ?? null;
      const days_since_last_visit =
        last_visit_at != null
          ? Math.floor((today.getTime() - new Date(last_visit_at).getTime()) / 86400000)
          : null;

      let expiry_urgency: 'critical' | 'warning' | 'upcoming';
      if (days_until_expiry <= 7) expiry_urgency = 'critical';
      else if (days_until_expiry <= 14) expiry_urgency = 'warning';
      else expiry_urgency = 'upcoming';

      const double_risk_flag =
        days_until_expiry <= 14 &&
        days_since_last_visit !== null &&
        days_since_last_visit > 30;

      const petKey = m.pet_id.toString();
      const cancelledCount = cancelledByPetMap.get(petKey) ?? 0;
      const renewal_count = Math.max(
        0,
        (petLogCountMap.get(petKey) ?? 1) - 1 - cancelledCount,
      );

      return {
        order_number: m.order_number ?? '',
        customer_name: oObj?.profile?.full_name ?? oObj?.username ?? '',
        customer_phone: oObj?.phone_number ?? '',
        pet_name: pObj?.name ?? '',
        membership_name: plan?.name ?? '',
        end_date: m.end_date ?? null,
        days_until_expiry,
        expiry_urgency,
        renewal_count,
        last_visit_at,
        days_since_last_visit,
        double_risk_flag,
        total_benefit_used: benefitUsedMap.get(m._id.toString()) ?? 0,
      };
    });

    rows.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

    return { data: rows, total: rows.length };
  }

  // ─── Report C: Membership Revenue & Renewal Rate ──────────────────────────────

  private static readonly ID_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];

  private monthPeriodKey(d: Date): { key: string; label: string } {
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const mon = ReportsService.ID_MONTHS[m];
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${y}-${String(m + 1).padStart(2, '0')} (1 – ${last} ${mon} ${y})`,
    };
  }

  private isoWeekPeriodKey(d: Date): { key: string; label: string } {
    // Thursday of the ISO week decides the week-year & number.
    const thu = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = thu.getUTCDay() || 7;
    thu.setUTCDate(thu.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    const key = `${thu.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    const mon = new Date(thu);
    mon.setUTCDate(thu.getUTCDate() - 3); // Monday
    const sun = new Date(thu);
    sun.setUTCDate(thu.getUTCDate() + 3); // Sunday

    const M = ReportsService.ID_MONTHS;
    const d1 = mon.getUTCDate();
    const d2 = sun.getUTCDate();
    const m1 = mon.getUTCMonth();
    const m2 = sun.getUTCMonth();
    const y1 = mon.getUTCFullYear();
    const y2 = sun.getUTCFullYear();
    let range: string;
    if (y1 !== y2) {
      range = `${d1} ${M[m1]} ${y1} – ${d2} ${M[m2]} ${y2}`;
    } else if (m1 !== m2) {
      range = `${d1} ${M[m1]} – ${d2} ${M[m2]} ${y2}`;
    } else {
      range = `${d1} – ${d2} ${M[m2]} ${y2}`;
    }
    return { key, label: `${key} (${range})` };
  }

  async getMembershipRevenueReport(dto: MembershipRevenueReportDto) {
    const today = new Date();
    const grouping = dto.period === 'week' ? 'week' : 'month';
    const THIRTY_DAYS = 30 * 86400000;

    // Default range: trailing 12 months ending today.
    const dateTo = dto.date_to ? new Date(dto.date_to) : new Date(today);
    const rangeEnd = new Date(dateTo);
    rangeEnd.setHours(23, 59, 59, 999);
    let dateFrom: Date;
    if (dto.date_from) {
      dateFrom = new Date(dto.date_from);
    } else {
      dateFrom = new Date(dateTo);
      dateFrom.setMonth(dateFrom.getMonth() - 12);
    }
    dateFrom.setHours(0, 0, 0, 0);
    const inRange = (d: Date) => d >= dateFrom && d <= rangeEnd;
    // key → human label ("2026-W19 (4 – 10 Mei 2026)" / "2026-05 (1 – 31 Mei 2026)")
    const periodLabels = new Map<string, string>();
    const periodKeyOf = (d: Date): string => {
      const { key, label } =
        grouping === 'week'
          ? this.isoWeekPeriodKey(d)
          : this.monthPeriodKey(d);
      if (!periodLabels.has(key)) periodLabels.set(key, label);
      return key;
    };

    // Every purchase/renewal transaction. One log = one membership sold.
    const allLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: {
          $in: [MembershipEventType.PURCHASED, MembershipEventType.RENEWED],
        },
      })
      .select(
        'pet_id membership_plan_id pet_membership_id event_date start_date end_date purchase_price createdAt',
      )
      .exec();

    // Plan price / name / tier lookup (price is the revenue fallback when a
    // log carries no purchase_price; name/tier feed the per-period and summary
    // breakdowns).
    const planIds = [
      ...new Set(allLogs.map((l) => l.membership_plan_id.toString())),
    ];
    const planDocs = await this.membershipModel
      .find({ _id: { $in: planIds.map((id) => new Types.ObjectId(id)) } })
      .select('name price badge_variant')
      .exec();
    const planMap = new Map(
      planDocs.map((p) => [
        p._id.toString(),
        {
          name: (p as any).name as string,
          price: (p as any).price as number,
          tier: ((p as any).badge_variant as string) ?? '',
        },
      ]),
    );

    // "Periode" basis = created_at of the membership-log transaction
    // (fallback: event_date, then start_date).
    const purchasedAt = (l: any): Date =>
      l.createdAt
        ? new Date(l.createdAt)
        : l.event_date
          ? new Date(l.event_date)
          : new Date(l.start_date);

    // ── Per-period accumulator — one output row per period (all plans merged) ──
    type Cell = {
      period: string;
      new_memberships: number;
      renewed_memberships: number;
      early_renewals: number;
      late_renewals: number;
      lapsed_memberships: number;
      membership_revenue: number;
      by_plan: Map<string, { plan_tier: string; count: number; revenue: number }>;
    };
    const cells = new Map<string, Cell>();
    const getCell = (period: string): Cell => {
      let c = cells.get(period);
      if (!c) {
        c = {
          period,
          new_memberships: 0,
          renewed_memberships: 0,
          early_renewals: 0,
          late_renewals: 0,
          lapsed_memberships: 0,
          membership_revenue: 0,
          by_plan: new Map(),
        };
        cells.set(period, c);
      }
      return c;
    };

    // Per-plan revenue/count — feeds the summary breakdown only (no longer a
    // table dimension).
    const summaryPlan = new Map<
      string,
      { plan_name: string; plan_tier: string; count: number; revenue: number }
    >();

    // Full per-pet history decides "no prior record": the first transaction
    // chronologically (by created_at) is a new membership, the rest renewals.
    const logsByPet = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      const pid = log.pet_id.toString();
      if (!logsByPet.has(pid)) logsByPet.set(pid, []);
      logsByPet.get(pid)!.push(log);
    }

    for (const logs of logsByPet.values()) {
      logs.sort((a, b) => purchasedAt(a).getTime() - purchasedAt(b).getTime());

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const plan = planMap.get(log.membership_plan_id.toString());
        const price = (log.purchase_price ?? plan?.price ?? 0) as number;
        const boughtAt = purchasedAt(log);

        // Lapsed: expired with no renewal within 30 days of expiry. Counted
        // once the rolling 30-day window has closed, bucketed by expiry period.
        const endDate = log.end_date ? new Date(log.end_date) : null;
        if (endDate) {
          const windowClose = endDate.getTime() + THIRTY_DAYS;
          const next = logs[i + 1];
          const renewedInWindow =
            next != null && purchasedAt(next).getTime() <= windowClose;
          if (
            windowClose <= today.getTime() &&
            !renewedInWindow &&
            inRange(endDate)
          ) {
            getCell(periodKeyOf(endDate)).lapsed_memberships += 1;
          }
        }

        // New / renewed + revenue bucketed by created_at period.
        if (!inRange(boughtAt)) continue;
        const cell = getCell(periodKeyOf(boughtAt));
        if (i === 0) {
          cell.new_memberships += 1;
        } else {
          cell.renewed_memberships += 1;
          const prevEnd = logs[i - 1].end_date
            ? new Date(logs[i - 1].end_date)
            : null;
          // Early: bought before previous expiry (perk). Late: on/after (none).
          if (prevEnd && boughtAt < prevEnd) cell.early_renewals += 1;
          else cell.late_renewals += 1;
        }
        cell.membership_revenue += price;

        const planName = plan?.name ?? 'Unknown';
        const planTier = plan?.tier ?? '';
        const bp = cell.by_plan.get(planName) ?? {
          plan_tier: planTier,
          count: 0,
          revenue: 0,
        };
        bp.count += 1;
        bp.revenue += price;
        cell.by_plan.set(planName, bp);

        const e = summaryPlan.get(planName) ?? {
          plan_name: planName,
          plan_tier: planTier,
          count: 0,
          revenue: 0,
        };
        e.count += 1;
        e.revenue += price;
        summaryPlan.set(planName, e);
      }
    }

    // ── One flat row per period (matches MembershipRevenueRow) ────────────────
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const data = [...cells.values()]
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
      .map((c) => {
        const totalSold = c.new_memberships + c.renewed_memberships;
        const denom = c.renewed_memberships + c.lapsed_memberships;
        const renewal_rate_pct =
          denom > 0 ? round2((c.renewed_memberships / denom) * 100) : 0;
        return {
          period: c.period,
          period_label: periodLabels.get(c.period) ?? c.period,
          new_memberships: c.new_memberships,
          renewed_memberships: c.renewed_memberships,
          early_renewals: c.early_renewals,
          late_renewals: c.late_renewals,
          lapsed_memberships: c.lapsed_memberships,
          renewal_rate_pct,
          renewal_rate_flag: denom > 0 && renewal_rate_pct < 70,
          membership_revenue: c.membership_revenue,
          avg_membership_value:
            totalSold > 0 ? Math.round(c.membership_revenue / totalSold) : 0,
          by_plan_breakdown: [...c.by_plan.entries()]
            .map(([plan_name, v]) => ({
              plan_name,
              plan_tier: v.plan_tier,
              count: v.count,
              revenue: v.revenue,
            }))
            .sort(
              (a, b) =>
                b.revenue - a.revenue ||
                b.count - a.count ||
                a.plan_name.localeCompare(b.plan_name),
            ),
        };
      });

    // ── Report C renewal-rate summary (extra keys; table ignores them) ────────
    const sum = [...cells.values()].reduce(
      (acc, c) => {
        acc.new_memberships += c.new_memberships;
        acc.renewed_memberships += c.renewed_memberships;
        acc.early_renewals += c.early_renewals;
        acc.late_renewals += c.late_renewals;
        acc.lapsed_memberships += c.lapsed_memberships;
        acc.membership_revenue += c.membership_revenue;
        return acc;
      },
      {
        new_memberships: 0,
        renewed_memberships: 0,
        early_renewals: 0,
        late_renewals: 0,
        lapsed_memberships: 0,
        membership_revenue: 0,
      },
    );
    const totalSold = sum.new_memberships + sum.renewed_memberships;
    const totalDenom = sum.renewed_memberships + sum.lapsed_memberships;
    const summaryRate =
      totalDenom > 0 ? round2((sum.renewed_memberships / totalDenom) * 100) : 0;

    return {
      period_grouping: grouping,
      date_from: dateFrom,
      date_to: rangeEnd,
      summary: {
        ...sum,
        renewal_rate_pct: summaryRate,
        renewal_rate_flag: totalDenom > 0 && summaryRate < 70,
        avg_membership_value:
          totalSold > 0 ? Math.round(sum.membership_revenue / totalSold) : 0,
        by_plan_breakdown: [...summaryPlan.values()].sort(
          (a, b) => b.revenue - a.revenue,
        ),
      },
      data,
      total: data.length,
    };
  }

  async getBenefitUtilisationReport() {
    // 1 row per BenefitUsage event. Joins pet name (via PetMembership →
    // pet_id → Pets), membership plan name & price, and the target service
    // name (when scope is service/addon). benefit_index = position of
    // benefit_id inside the membership's benefits_snapshot array.
    const usages = await this.benefitUsageModel
      .find({ isDeleted: false })
      .sort({ used_at: -1 })
      .exec();

    if (usages.length === 0) {
      return { data: [], total: 0 };
    }

    // Cumulative amount_deducted per pet_membership_id (running total of
    // Rp value of all benefits consumed in this membership period). Sumber
    // sama dengan kolom amount_used per row (Booking.applied_benefits.
    // amount_deducted), tinggal di-group per pet_membership_id.
    const cumulativeAgg: { _id: Types.ObjectId; total: number }[] =
      await this.bookingModel.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: '$applied_benefits' },
        {
          $match: {
            'applied_benefits.pet_membership_id': { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$applied_benefits.pet_membership_id',
            total: { $sum: '$applied_benefits.amount_deducted' },
          },
        },
      ]);
    const cumulativeMap = new Map<string, number>();
    for (const agg of cumulativeAgg) {
      cumulativeMap.set(agg._id.toString(), agg.total);
    }

    // PetMemberships referenced by these usages (for pet_id, benefits_snapshot, plan).
    const pmIds = [...new Set(usages.map((u) => u.pet_membership_id.toString()))];
    const petMemberships = await this.petMembershipModel
      .find({ _id: { $in: pmIds.map((id) => new Types.ObjectId(id)) } })
      .populate({ path: 'membership_plan_id', model: 'Membership' })
      .exec();
    const pmMap = new Map(petMemberships.map((pm) => [pm._id.toString(), pm]));

    // Pets referenced via PetMembership.pet_id.
    const petIds = [...new Set(petMemberships.map((pm) => pm.pet_id.toString()))];
    const pets = await this.petModel
      .find({ _id: { $in: petIds.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const petMap = new Map(pets.map((p) => [p._id.toString(), (p as any).name as string]));

    // target_service is resolved through the membership's own snapshot:
    //   BenefitUsage.pet_membership_id → PetMembership
    //   → benefits_snapshot[i] where snapshot[i]._id === BenefitUsage.benefit_id
    //   → snapshot[i].service_id → Service.name
    // Collect every service_id referenced by any snapshot item in any
    // membership touched by these usages.
    const snapshotServiceIds = new Set<string>();
    for (const pm of petMemberships) {
      const pmObj = (pm as any).toObject({ virtuals: true });
      for (const b of pmObj.benefits_snapshot ?? []) {
        if (b.service_id) snapshotServiceIds.add(b.service_id.toString());
      }
    }
    const services = snapshotServiceIds.size > 0
      ? await this.serviceModel
          .find({
            _id: {
              $in: [...snapshotServiceIds].map((id) => new Types.ObjectId(id)),
            },
          })
          .select('name')
          .exec()
      : [];
    const serviceMap = new Map(services.map((s) => [s._id.toString(), (s as any).name as string]));

    // Bookings referenced by usage rows — needed for:
    //   - booking.code   → human-readable booking reference
    //   - selected_benefit_ids → benefit_index (position of BenefitUsage.benefit_id)
    //   - applied_benefits[index].amount_deducted → amount_used
    const bookingIds = [
      ...new Set(
        usages.filter((u) => u.booking_id).map((u) => u.booking_id.toString()),
      ),
    ];
    const bookings = bookingIds.length > 0
      ? await this.bookingModel
          .find({ _id: { $in: bookingIds.map((id) => new Types.ObjectId(id)) } })
          .select('code selected_benefit_ids applied_benefits')
          .exec()
      : [];
    const bookingMap = new Map(bookings.map((b) => [b._id.toString(), b]));

    const rows = usages.map((u) => {
      const pmId = u.pet_membership_id.toString();
      const pm = pmMap.get(pmId);
      const pmObj = pm ? (pm as any).toObject({ virtuals: true }) : null;
      const plan = pmObj?.membership_plan_id as any;

      const pet_name = pmObj ? (petMap.get(pmObj.pet_id.toString()) ?? '') : '';
      const membership_name = plan?.name ?? '';
      const membership_price = (pmObj?.purchase_price ?? plan?.price ?? 0) as number;

      const snapshot = (pmObj?.benefits_snapshot ?? []) as Array<{
        _id?: Types.ObjectId;
        service_id?: Types.ObjectId;
        label?: string;
      }>;
      // benefit_index dicari di Booking.selected_benefit_ids dengan
      // mencocokkan BenefitUsage.benefit_id. amount_used diambil dari
      // applied_benefits[index].amount_deducted (selected_benefit_ids dan
      // applied_benefits diasumsikan paralel — keduanya ditulis dari
      // pilihan benefit yang sama saat booking dibuat).
      const booking = u.booking_id
        ? (bookingMap.get(u.booking_id.toString()) as any)
        : null;
      const selectedIds = (booking?.selected_benefit_ids ?? []) as Types.ObjectId[];
      const appliedBenefits = (booking?.applied_benefits ?? []) as Array<{
        amount_deducted?: number;
        benefit?: { _id?: Types.ObjectId };
      }>;
      const benefit_index_raw = selectedIds.findIndex(
        (sid) => sid?.toString() === u.benefit_id?.toString(),
      );
      const benefit_index = benefit_index_raw >= 0 ? benefit_index_raw : null;

      // amount_used = applied_benefits[index].amount_deducted. Fallback:
      // cari applied_benefits.benefit._id yang cocok kalau array tidak paralel.
      let amount_used = 0;
      if (benefit_index !== null && appliedBenefits[benefit_index]) {
        amount_used = appliedBenefits[benefit_index].amount_deducted ?? 0;
      } else {
        const ab = appliedBenefits.find(
          (a) => a.benefit?._id?.toString() === u.benefit_id?.toString(),
        );
        if (ab) amount_used = ab.amount_deducted ?? 0;
      }

      // target_service via snapshot[i].service_id → Service.name, dimana i
      // adalah posisi benefit_id di benefits_snapshot (bukan di
      // selected_benefit_ids). Fallback ke snapshot[i].label kalau
      // service_id null.
      const snapshotIdx = snapshot.findIndex(
        (b) => b._id?.toString() === u.benefit_id?.toString(),
      );
      const matchedBenefit = snapshotIdx >= 0 ? snapshot[snapshotIdx] : null;
      const target_service = matchedBenefit?.service_id
        ? (serviceMap.get(matchedBenefit.service_id.toString()) ?? matchedBenefit.label ?? '')
        : (matchedBenefit?.label ?? '');

      const cumulative_used = cumulativeMap.get(pmId) ?? 0;
      const benefit_vs_price_pct =
        membership_price > 0
          ? Math.round((cumulative_used / membership_price) * 10000) / 100
          : 0;

      // booking_id → booking.code (human-readable reference).
      // pet_membership_id → PetMembership.order_number.
      const bookingCode = (booking as any)?.code ?? '';
      const pmOrderNumber = pmObj?.order_number ?? '';

      return {
        benefit_usage_id: u._id.toString(),
        used_at: u.used_at ?? null,
        booking_id: bookingCode,
        pet_membership_id: pmOrderNumber,
        pet_name,
        membership_name,
        benefit_type: u.scope ?? '',
        target_service,
        amount_used,
        benefit_index,
        cumulative_used,
        membership_price,
        benefit_vs_price_pct,
      };
    });

    return { data: rows, total: rows.length };
  }
}
