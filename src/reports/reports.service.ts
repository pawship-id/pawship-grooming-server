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
import {
  MembershipLog,
  MembershipLogDocument,
  MembershipEventType,
} from 'src/pet-membership/entities/membership-log.entity';
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
      const notExpired = m.end_date ? new Date(m.end_date) >= today : false;
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
    if (endDate && now > new Date(endDate)) return 'expired';
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

    // Count total log entries and build lookup maps
    const logCountMap = new Map<string, number>();
    const logsByGroupMap = new Map<string, (typeof allLogs)>();
    const allLogsByPetMap = new Map<string, (typeof allLogs)>();
    for (const log of allLogs) {
      const key = `${log.pet_id.toString()}::${log.membership_plan_id.toString()}`;
      logCountMap.set(key, (logCountMap.get(key) ?? 0) + 1);
      if (!logsByGroupMap.has(key)) logsByGroupMap.set(key, []);
      logsByGroupMap.get(key)!.push(log);
      const petId = log.pet_id.toString();
      if (!allLogsByPetMap.has(petId)) allLogsByPetMap.set(petId, []);
      allLogsByPetMap.get(petId)!.push(log);
    }

    // Plan name map for all membership_plan_ids referenced in logs (for previous_plan lookup)
    const allLogPlanIds = [...new Set(allLogs.map((l) => l.membership_plan_id.toString()))];
    const logPlanDocs = await this.membershipModel
      .find({ _id: { $in: allLogPlanIds.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const logPlanNameMap = new Map(logPlanDocs.map((p) => [p._id.toString(), (p as any).name as string]));

    // Fetch ALL non-deleted PetMemberships, then keep ONE per (pet_id, membership_plan_id):
    // a pet may show several rows as long as the plan differs, but never the same plan twice.
    // Uses the PM's ACTUAL dates + the canonical status logic (membershipReportStatus). Logs
    // are only supplementary (renewal count / early renewal / previous plan) — they must NOT
    // filter which memberships appear, otherwise an active membership with no log entry would
    // be hidden behind a logged "menunggu" one.
    // Priority per (pet, plan): active → menunggu → expired → cancelled; tie-break: latest
    // end_date (or, when both are menunggu, the soonest start_date).
    const candidateMemberships = await this.petMembershipModel
      .find({ isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership' })
      .sort({ pet_id: 1, start_date: -1 })
      .exec();

    const statusRank = (s: string) =>
      s === 'active' ? 0 : s === 'menunggu' ? 1 : s === 'expired' ? 2 : 3;

    // One membership per (pet_id, membership_plan_id)
    const pmGroupMap = new Map<string, (typeof candidateMemberships)[0]>();
    for (const pm of candidateMemberships) {
      const mObj = (pm as any).toObject({ virtuals: true });
      const planId = (mObj.membership_plan_id as any)?._id?.toString() ?? '';
      const key = `${pm.pet_id.toString()}::${planId}`;
      const status = this.membershipReportStatus(
        pm.is_active,
        pm.start_date,
        pm.end_date,
        today,
      );
      const existing = pmGroupMap.get(key);
      if (!existing) {
        pmGroupMap.set(key, pm);
        continue;
      }
      const exStatus = this.membershipReportStatus(
        existing.is_active,
        existing.start_date,
        existing.end_date,
        today,
      );
      const rank = statusRank(status);
      const exRank = statusRank(exStatus);
      if (rank < exRank) {
        pmGroupMap.set(key, pm); // higher-priority status wins
      } else if (rank === exRank) {
        if (status === 'menunggu') {
          // both menunggu → prefer the one starting soonest (closest start_date)
          const pmStart = pm.start_date ? new Date(pm.start_date).getTime() : Infinity;
          const exStart = existing.start_date ? new Date(existing.start_date).getTime() : Infinity;
          if (pmStart < exStart) pmGroupMap.set(key, pm);
        } else {
          const pmEnd = pm.end_date ? new Date(pm.end_date).getTime() : 0;
          const exEnd = existing.end_date ? new Date(existing.end_date).getTime() : 0;
          if (pmEnd > exEnd) pmGroupMap.set(key, pm); // same status → latest end_date
        }
      }
    }

    // Early renewal: flag the DISPLAYED PM if any log in its (pet_id, plan) group was
    // created during another log's active period.
    const earlyRenewalSet = new Set<string>(); // pet_membership_id strings
    for (const pm of pmGroupMap.values()) {
      const mObj = (pm as any).toObject({ virtuals: true });
      const planId = (mObj.membership_plan_id as any)?._id?.toString() ?? '';
      const groupLogs = logsByGroupMap.get(`${pm.pet_id.toString()}::${planId}`) ?? [];
      if (groupLogs.length <= 1) continue;
      const hasEarlyRenewal = groupLogs.some((log) => {
        const createdAt = (log as any).createdAt ? new Date((log as any).createdAt) : null;
        if (!createdAt) return false;
        return groupLogs.some(
          (other) =>
            other._id.toString() !== log._id.toString() &&
            createdAt >= new Date(other.start_date) &&
            createdAt <= new Date(other.end_date),
        );
      });
      if (hasEarlyRenewal) earlyRenewalSet.add(pm._id.toString());
    }

    const allMemberships = [...pmGroupMap.values()];

    // Group by pet_id to compute per-pet renewal info (across all logs, not just selected)
    const petMembershipGroups = new Map<string, any[]>();
    for (const m of allMemberships) {
      const key = m.pet_id.toString();
      if (!petMembershipGroups.has(key)) petMembershipGroups.set(key, []);
      petMembershipGroups.get(key)!.push(m);
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

      // renewal_count = total purchased+renewed log entries for this (pet_id, membership_plan_id) group
      const logKey = `${m.pet_id.toString()}::${plan?._id?.toString() ?? ''}`;
      const renewal_count = Math.max(0, (logCountMap.get(logKey) ?? 1) - 1);

      const is_early_renewal = earlyRenewalSet.has(m._id.toString());

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
      };
    });

    // Sort: active → menunggu → expired → cancelled, then by end_date asc (soonest expiry first)
    const sortRank = (s: string) =>
      s === 'active' ? 0 : s === 'menunggu' ? 1 : s === 'expired' ? 2 : 3;
    rows.sort((a, b) => {
      const ra = sortRank(a.membership_status);
      const rb = sortRank(b.membership_status);
      if (ra !== rb) return ra - rb;
      const da = a.end_date ? new Date(a.end_date).getTime() : 0;
      const db = b.end_date ? new Date(b.end_date).getTime() : 0;
      return da - db;
    });

    return { data: rows, total: rows.length };
  }

  async getMembershipExpiryReport() {
    const today = new Date();

    // Fetch purchased/renewed logs — drives the (pet_id, membership_plan_id)
    // grouping and the per-group renewal count, mirroring the detail report.
    const allLogs = await this.membershipLogModel
      .find({
        isDeleted: false,
        event_type: {
          $in: [MembershipEventType.PURCHASED, MembershipEventType.RENEWED],
        },
      })
      .select('pet_id membership_plan_id pet_membership_id start_date end_date createdAt')
      .exec();

    const logCountMap = new Map<string, number>();
    for (const log of allLogs) {
      const key = `${log.pet_id.toString()}::${log.membership_plan_id.toString()}`;
      logCountMap.set(key, (logCountMap.get(key) ?? 0) + 1);
    }

    // Keep ONE PetMembership per (pet_id, membership_plan_id). A pet may show
    // several rows as long as the plan differs, but never the same plan twice.
    // Priority per (pet, plan): active → menunggu → expired → cancelled;
    // tie-break: latest end_date (or, when both menunggu, soonest start_date).
    const candidateMemberships = await this.petMembershipModel
      .find({ isDeleted: false })
      .populate({ path: 'membership_plan_id', model: 'Membership' })
      .sort({ pet_id: 1, start_date: -1 })
      .exec();

    const statusRank = (s: string) =>
      s === 'active' ? 0 : s === 'menunggu' ? 1 : s === 'expired' ? 2 : 3;

    const pmGroupMap = new Map<string, (typeof candidateMemberships)[0]>();
    for (const pm of candidateMemberships) {
      const mObj = (pm as any).toObject({ virtuals: true });
      const planId = (mObj.membership_plan_id as any)?._id?.toString() ?? '';
      const key = `${pm.pet_id.toString()}::${planId}`;
      const status = this.membershipReportStatus(
        pm.is_active,
        pm.start_date,
        pm.end_date,
        today,
      );
      const existing = pmGroupMap.get(key);
      if (!existing) {
        pmGroupMap.set(key, pm);
        continue;
      }
      const exStatus = this.membershipReportStatus(
        existing.is_active,
        existing.start_date,
        existing.end_date,
        today,
      );
      const rank = statusRank(status);
      const exRank = statusRank(exStatus);
      if (rank < exRank) {
        pmGroupMap.set(key, pm); // higher-priority status wins
      } else if (rank === exRank) {
        if (status === 'menunggu') {
          const pmStart = pm.start_date ? new Date(pm.start_date).getTime() : Infinity;
          const exStart = existing.start_date ? new Date(existing.start_date).getTime() : Infinity;
          if (pmStart < exStart) pmGroupMap.set(key, pm);
        } else {
          const pmEnd = pm.end_date ? new Date(pm.end_date).getTime() : 0;
          const exEnd = existing.end_date ? new Date(existing.end_date).getTime() : 0;
          if (pmEnd > exEnd) pmGroupMap.set(key, pm); // same status → latest end_date
        }
      }
    }

    const allMemberships = [...pmGroupMap.values()];

    const petIds = [...new Set(allMemberships.map((m) => m.pet_id.toString()))];
    const pets = await this.petModel
      .find({ _id: { $in: petIds }, isDeleted: false })
      .populate('pet_type')
      .exec();
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));

    const customerIds = [...new Set(pets.map((p) => p.customer_id.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: customerIds } })
      .exec();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Last completed booking date per pet
    const lastBookingAgg: { _id: Types.ObjectId; last_at: Date }[] =
      await this.bookingModel.aggregate([
        { $match: { isDeleted: false, booking_status: 'completed' } },
        { $group: { _id: '$pet_id', last_at: { $max: '$date' } } },
      ]);
    const lastVisitMap = new Map<string, Date>(
      lastBookingAgg.map((a) => [a._id.toString(), a.last_at]),
    );

    // Total benefit value used per pet_membership_id — sourced from Booking
    // data (applied_benefits.amount_deducted), identical to "Total Nilai
    // Digunakan" in the Membership Detail Report.
    const benefitAgg: { _id: Types.ObjectId; total_amount: number }[] =
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
      benefitAgg.map((a) => [a._id.toString(), a.total_amount]),
    );

    const rows = allMemberships.map((m) => {
      const mObj = (m as any).toObject({ virtuals: true });
      const plan = mObj.membership_plan_id as any;
      const pet = petMap.get(m.pet_id.toString());
      const pObj = pet ? (pet as any).toObject({ virtuals: true }) : null;
      const owner = pObj ? userMap.get(pObj.customer_id?.toString()) : null;
      const oObj = owner ? (owner as any).toObject({ virtuals: true }) : null;

      const endDate = m.end_date ? new Date(m.end_date) : null;
      const days_until_expiry = endDate
        ? Math.round((endDate.getTime() - today.getTime()) / 86400000)
        : null;
      const status = m.is_active && endDate && endDate >= today ? 'active' : 'expired';

      const last_visit_at = lastVisitMap.get(m.pet_id.toString()) ?? null;
      const days_since_last_visit =
        last_visit_at != null
          ? Math.floor((today.getTime() - new Date(last_visit_at).getTime()) / 86400000)
          : null;

      // Urgensi tier (colour coding + outreach priority):
      //   ≤ 7 (incl. already-expired) → critical
      //   8–14                        → warning
      //   15–30                       → upcoming
      let expiry_urgency: 'critical' | 'warning' | 'upcoming' | null = null;
      if (days_until_expiry !== null) {
        if (days_until_expiry <= 7) expiry_urgency = 'critical';
        else if (days_until_expiry <= 14) expiry_urgency = 'warning';
        else if (days_until_expiry <= 30) expiry_urgency = 'upcoming';
      }

      const double_risk_flag =
        days_until_expiry !== null &&
        days_until_expiry <= 14 &&
        days_since_last_visit !== null &&
        days_since_last_visit > 30;

      // renewal_count = purchased+renewed log entries for this
      // (pet_id, membership_plan_id) group, minus the initial purchase
      const logKey = `${m.pet_id.toString()}::${plan?._id?.toString() ?? ''}`;
      const renewal_count = Math.max(0, (logCountMap.get(logKey) ?? 1) - 1);

      return {
        membership_id: m._id.toString(),
        member_code: plan?.code ?? '',
        pet_id: m.pet_id.toString(),
        pet_code: pObj?.code ?? '',
        pet_name: pObj?.name ?? '',
        pet_type: (pObj?.pet_type as any)?.name ?? '',
        customer_code: oObj?.code ?? '',
        owner_name: oObj?.profile?.full_name ?? oObj?.username ?? '',
        owner_phone: oObj?.phone_number ?? '',
        plan_name: plan?.name ?? '',
        plan_tier: plan?.badge_variant ?? '',
        start_date: m.start_date ?? null,
        expiry_date: m.end_date ?? null,
        days_until_expiry,
        expiry_urgency,
        renewal_count,
        last_visit_at,
        days_since_last_visit,
        double_risk_flag,
        total_benefit_used: benefitUsedMap.get(m._id.toString()) ?? 0,
        status,
      };
    });

    // Only keep memberships expiring in ≤ 30 days, including ones already past
    // their expiry date (negative days_until_expiry).
    const filteredRows = rows.filter(
      (r) => r.days_until_expiry !== null && r.days_until_expiry <= 30,
    );

    // Sort: active first, then by expiry date asc (soonest expiry first)
    filteredRows.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      const da = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
      const db = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
      return da - db;
    });

    return { data: filteredRows, total: filteredRows.length };
  }
}
