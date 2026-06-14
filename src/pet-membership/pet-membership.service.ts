import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import {
  PetMembership,
  PetMembershipDocument,
} from './entities/pet-membership.entity';
import {
  MembershipLog,
  MembershipLogDocument,
  MembershipEventType,
} from './entities/membership-log.entity';
import {
  Membership,
  MembershipDocument,
  BenefitPeriod,
} from '../membership/entities/membership.entity';
import { Service, ServiceDocument } from '../service/entities/service.entity';
import { Pet, PetDocument } from '../pet/entities/pet.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { CreatePetMembershipDto } from './dto/create-pet-membership.dto';
import { UpdatePetMembershipDto } from './dto/update-pet-membership.dto';
import { GetPetMembershipQueryDto } from './dto/get-pet-membership-query.dto';
import { RenewPetMembershipDto } from './dto/renew-pet-membership.dto';
import { BenefitUsageService } from 'src/benefit-usage/benefit-usage.service';
import { CounterService } from 'src/counter/counter.service';

@Injectable()
export class PetMembershipService implements OnModuleInit {
  /**
   * Pembersihan legacy unique index pada order_number. Sebelumnya order_number
   * sempat diizinkan duplicate (untuk reuse di rangkaian renewal), sehingga
   * environment lama bisa jadi masih punya unique index yang akan menolak
   * data lama dengan duplikasi. Sekarang setiap pembelian dijamin unique via
   * counter, jadi DB-level unique constraint tidak ditambahkan untuk
   * menghindari konflik dengan data legacy yang masih duplikat.
   */
  async onModuleInit(): Promise<void> {
    try {
      const indexes = await this.petMembershipModel.collection.indexes();
      const legacyUniqueIndex = indexes.find(
        (idx) => idx.unique && idx.key && idx.key.order_number !== undefined,
      );
      if (legacyUniqueIndex?.name) {
        await this.petMembershipModel.collection.dropIndex(
          legacyUniqueIndex.name,
        );
      }
    } catch {
      // Index belum ada / collection belum dibuat — aman diabaikan.
    }
  }

  constructor(
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
    @InjectModel(MembershipLog.name)
    private membershipLogModel: Model<MembershipLogDocument>,
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
    @InjectModel(Service.name)
    private serviceModel: Model<ServiceDocument>,
    @InjectModel(Pet.name)
    private petModel: Model<PetDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly benefitUsageService: BenefitUsageService,
    private readonly counterService: CounterService,
  ) {}

  async create(
    createPetMembershipDto: CreatePetMembershipDto,
  ): Promise<PetMembership> {
    const { pet_id, membership_plan_id } = createPetMembershipDto;

    // Validate membership exists
    const membership = await this.membershipModel.findOne({
      _id: new Types.ObjectId(membership_plan_id),
      isDeleted: false,
    });

    if (!membership) {
      throw new BadRequestException('membership plan not found');
    }

    // Calculate dates
    const startDate = createPetMembershipDto.start_date
      ? new Date(createPetMembershipDto.start_date)
      : new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + membership.duration_months);

    // Block purchase only if the new period overlaps with an active/pending membership
    // of the SAME plan. Different plans pada pet yang sama tetap diperbolehkan overlap.
    // Uses merged-period logic so a chain like [active → pending] is treated as one blocked block.
    const overlapBlock = await this.findMergedOverlap(
      new Types.ObjectId(pet_id),
      new Types.ObjectId(membership_plan_id),
      startDate,
      endDate,
    );

    if (overlapBlock) {
      const availableFrom = new Date(overlapBlock.blockedUntil);
      availableFrom.setDate(availableFrom.getDate() + 1);
      throw new BadRequestException(
        `Tanggal mulai bertabrakan dengan "${overlapBlock.planName}" yang sudah ada. Membership tersedia mulai: ${availableFrom.toISOString().split('T')[0]}`,
      );
    }

    // Create benefits snapshot dari membership dengan period reset date
    const benefitsSnapshot = membership.benefits.map((b) => {
      const periodResetDate = this.calculateNextPeriodResetDate(
        startDate,
        b.period,
      );
      return {
        _id: b._id,
        applies_to: b.applies_to,
        service_id: b.service_id,
        label: b.label,
        type: b.type,
        period: b.period,
        limit: b.limit,
        value: b.value,
        used: 0,
        period_reset_date: periodResetDate,
      };
    });

    // Use override price if provided, otherwise use plan price
    const purchasePrice =
      createPetMembershipDto.purchase_price != null
        ? createPetMembershipDto.purchase_price
        : membership.price;

    // Setiap pembelian membership selalu mendapat order_number baru yang unik
    // (auto-incrementing): ORD-MEM-0001, ORD-MEM-0002, ...
    const seq = await this.counterService.getNextSequence(
      'pet-membership-order',
    );
    const orderNumber = `ORD-MEM-${String(seq).padStart(4, '0')}`;

    const petMembership = new this.petMembershipModel({
      order_number: orderNumber,
      pet_id: new Types.ObjectId(pet_id),
      membership_plan_id: new Types.ObjectId(membership_plan_id),
      start_date: startDate,
      end_date: endDate,
      base_price: membership.price,
      purchase_price: purchasePrice,
      purchase_note: createPetMembershipDto.purchase_note || undefined,
      benefits_snapshot: benefitsSnapshot,
    });

    const saved = await petMembership.save();

    await this.createLog({
      pet_id: saved.pet_id,
      pet_membership_id: (saved as any)._id,
      membership_plan_id: saved.membership_plan_id,
      event_type: MembershipEventType.PURCHASED,
      start_date: startDate,
      end_date: endDate,
      purchase_price: purchasePrice,
      benefits_snapshot_before: benefitsSnapshot,
      note: createPetMembershipDto.purchase_note || undefined,
    });

    return saved;
  }

  async getCounts(petId: string): Promise<Record<string, number>> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }
    const id = new Types.ObjectId(petId);
    const now = new Date();
    const todayStart = this.startOfDayUtc(now);
    const base = { pet_id: id, isDeleted: false };
    const [active, pending, expired, cancelled] = await Promise.all([
      this.petMembershipModel.countDocuments({
        ...base,
        is_active: true,
        start_date: { $lte: now },
        end_date: { $gte: todayStart },
      }),
      this.petMembershipModel.countDocuments({
        ...base,
        is_active: true,
        start_date: { $gt: now },
      }),
      this.petMembershipModel.countDocuments({
        ...base,
        is_active: true,
        end_date: { $lt: todayStart },
      }),
      this.petMembershipModel.countDocuments({ ...base, is_active: false }),
    ]);
    return { active, pending, expired, cancelled };
  }

  async exportAll(): Promise<any[]> {
    const petMemberships = await this.petMembershipModel
      .find({ isDeleted: false })
      .populate({
        path: 'pet',
        select: 'name pet_type_id customer_id',
        populate: [
          { path: 'pet_type', select: 'name' },
          { path: 'owner', select: 'username' },
        ],
      })
      .populate('membership', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return petMemberships.map((pm: any) => ({
      pet_name: pm.pet?.name ?? '-',
      pet_type: pm.pet?.pet_type?.name ?? '-',
      owner_name: pm.pet?.owner?.username ?? '-',
      membership_name: pm.membership?.name ?? '-',
      buy_date: pm.createdAt ?? null,
      start_date: pm.start_date ?? null,
      end_date: pm.end_date ?? null,
    }));
  }

  async findAll(query: GetPetMembershipQueryDto): Promise<{
    data: any[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    statusCounts?: {
      active: number;
      pending: number;
      expired: number;
      cancelled: number;
    };
  }> {
    const now = new Date();
    const todayStart = this.startOfDayUtc(now);

    // Build base conditions (without status filter — needed for statusCounts).
    const baseConditions: any = { isDeleted: false };

    if (query.pet_id) {
      baseConditions.pet_id = new Types.ObjectId(query.pet_id);
    }

    if (query.membership_plan_id) {
      baseConditions.membership_plan_id = new Types.ObjectId(
        query.membership_plan_id,
      );
    }

    // Date range filter on end_date.
    if (query.date_from || query.date_to) {
      baseConditions.end_date = {};
      if (query.date_from) {
        baseConditions.end_date.$gte = this.startOfDayUtc(
          new Date(query.date_from),
        );
      }
      if (query.date_to) {
        const to = new Date(query.date_to);
        to.setUTCHours(23, 59, 59, 999);
        baseConditions.end_date.$lte = to;
      }
    }

    // Resolve search keyword to pet_ids and membership_plan_ids (when q provided).
    let searchEmpty = false;
    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      const regex = new RegExp(this.escapeRegex(q), 'i');

      const [matchingUsers, matchingPlans] = await Promise.all([
        this.userModel.find({ username: regex }).select('_id').lean(),
        this.membershipModel.find({ name: regex }).select('_id').lean(),
      ]);

      const ownerIds = matchingUsers.map((u: any) => u._id);
      const planIds = matchingPlans.map((p: any) => p._id);

      const matchingPets = await this.petModel
        .find({
          $or: [
            { name: regex },
            ...(ownerIds.length ? [{ customer_id: { $in: ownerIds } }] : []),
          ],
        })
        .select('_id')
        .lean();
      const petIds = matchingPets.map((p: any) => p._id);

      const orClauses: any[] = [];
      if (petIds.length) orClauses.push({ pet_id: { $in: petIds } });
      if (planIds.length)
        orClauses.push({ membership_plan_id: { $in: planIds } });

      if (orClauses.length === 0) {
        // No match for search keyword — return empty quickly.
        searchEmpty = true;
      } else {
        baseConditions.$or = orClauses;
      }
    }

    // Build status-specific conditions.
    const applyStatus = (
      cond: any,
      status: 'active' | 'pending' | 'expired' | 'cancelled' | undefined,
    ): any => {
      const c: any = { ...cond };
      if (status === 'cancelled') {
        c.is_active = false;
      } else if (status === 'active') {
        c.is_active = true;
        c.start_date = { $lte: now };
        // Merge end_date constraints carefully if date filter sudah ada.
        c.end_date = { ...(c.end_date || {}), $gte: todayStart };
      } else if (status === 'pending') {
        c.is_active = true;
        c.start_date = { $gt: now };
      } else if (status === 'expired') {
        c.is_active = true;
        c.end_date = { ...(c.end_date || {}), $lt: todayStart };
      } else {
        // No status filter: include both active=true and active=false.
        // (Backward compat: when no `status` is provided, default to active-only
        // for callers like the per-pet flow that don't expect cancelled records.)
        c.is_active = true;
      }
      return c;
    };

    const conditions = applyStatus(baseConditions, query.status);

    // Compute statusCounts in parallel (across baseConditions, ignoring status).
    const buildCountCond = (
      status: 'active' | 'pending' | 'expired' | 'cancelled',
    ) => applyStatus(baseConditions, status);

    // Early-exit path: search returned no matching ids.
    if (searchEmpty) {
      const page = query.page ?? 1;
      const limit = query.limit ?? (query.page ? 20 : 100);
      return {
        data: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
        statusCounts: { active: 0, pending: 0, expired: 0, cancelled: 0 },
      };
    }

    // Pagination params. When neither `page` nor `limit` is supplied (e.g. the
    // per-pet caller), default to limit=100 — small enough to be fast, large
    // enough for typical per-pet history.
    const page = query.page ?? 1;
    const limit = query.limit ?? (query.page ? 20 : 100);
    const skip = (page - 1) * limit;

    const [total, activeCount, pendingCount, expiredCount, cancelledCount, docs] =
      await Promise.all([
        this.petMembershipModel.countDocuments(conditions),
        this.petMembershipModel.countDocuments(buildCountCond('active')),
        this.petMembershipModel.countDocuments(buildCountCond('pending')),
        this.petMembershipModel.countDocuments(buildCountCond('expired')),
        this.petMembershipModel.countDocuments(buildCountCond('cancelled')),
        this.petMembershipModel
          .find(conditions)
          .sort({ end_date: 1 })
          .skip(skip)
          .limit(limit)
          .populate({
            path: 'pet',
            select: 'name tags pet_type_id customer_id',
            populate: [
              { path: 'pet_type', select: 'name' },
              { path: 'owner', select: 'username' },
            ],
          })
          .populate('membership', 'name description duration_months price')
          .lean()
          .exec(),
      ]);

    // Populate services in benefits_snapshot. populateBenefitsWithServices
    // already handles both Mongoose docs and lean objects.
    const result = await this.populateBenefitsWithServices(docs as any);
    const populated = Array.isArray(result) ? result : [result];

    const data = populated.map((pm: any) => ({
      ...pm,
      status: this.computeStatus(pm.is_active, pm.start_date, pm.end_date),
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      statusCounts: {
        active: activeCount,
        pending: pendingCount,
        expired: expiredCount,
        cancelled: cancelledCount,
      },
    };
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async findById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const petMembership = await this.petMembershipModel
      .findOne({
        _id: new Types.ObjectId(id),
        isDeleted: false,
        is_active: true,
      })
      .populate({
        path: 'pet',
        select: 'name tags pet_type_id customer_id',
        populate: [
          {
            path: 'pet_type',
            select: 'name',
          },
          {
            path: 'owner',
            select: 'username',
          },
        ],
      })
      .populate('membership', 'name description duration_months price');

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    // Populate services in benefits_snapshot
    return this.populateBenefitsWithServices(petMembership);
  }

  async getActiveMembership(
    petId: string,
    targetDate?: Date,
  ): Promise<any | null> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }

    const effectiveDate = targetDate ?? new Date();
    const effectiveDateStart = this.startOfDayUtc(effectiveDate);
    const petMembership = await this.petMembershipModel
      .find({
        pet_id: new Types.ObjectId(petId),
        start_date: { $lte: effectiveDate },
        end_date: { $gte: effectiveDateStart }, // inklusif sepanjang hari end_date
        isDeleted: false,
        is_active: true,
      })
      .populate({
        path: 'pet',
        select:
          'name tags pet_type_id size_category_id hair_category_id customer_id',
        populate: [
          {
            path: 'pet_type',
            select: 'name',
          },
          {
            path: 'size',
            select: 'name',
          },
          {
            path: 'hair',
            select: 'name',
          },
          {
            path: 'owner',
            select: 'username',
          },
        ],
      })
      .populate('membership', 'name description duration_months price')
      .exec();

    if (!petMembership || petMembership.length === 0) {
      return null;
    }

    // Populate services in benefits_snapshot
    return this.populateBenefitsWithServices(petMembership);
  }

  async getAvailableBenefits(
    petId: string,
    bookingDate?: Date,
    excludeBookingId?: string,
  ): Promise<any> {
    const activeMemberships = await this.getActiveMembership(petId, bookingDate);

    if (!activeMemberships) {
      return {
        has_active_membership: false,
        memberships: [],
        benefits: [],
      };
    }

    const now = new Date();
    const allBenefits: any[] = [];
    const memberships: any[] = [];

    for (const petMembership of activeMemberships) {
      const pmId =
        (petMembership as any)._id?.toString() || (petMembership as any).id;

      const benefits = await this.enrichBenefits(
        petMembership.benefits_snapshot || [],
        pmId,
        now,
        bookingDate,
        excludeBookingId,
      );

      allBenefits.push(...benefits);

      memberships.push({
        pet_membership_id: pmId,
        membership_plan_id:
          (petMembership as any).membership_plan_id?.toString() ?? null,
        membership_name: (petMembership as any).membership?.name ?? null,
        start_date: petMembership.start_date,
        end_date: petMembership.end_date,
        benefits,
      });
    }

    return {
      has_active_membership: true,
      memberships,
      benefits: allBenefits,
    };
  }

  async getBenefitsSummary(petId: string, bookingDate?: Date): Promise<any[]> {
    const activeMemberships = await this.getActiveMembership(petId, bookingDate);

    if (!activeMemberships) {
      return [];
    }

    const now = new Date();

    return Promise.all(
      activeMemberships.map(async (petMembership: any) => {
        const pmId = petMembership._id?.toString() || petMembership.id;

        return {
          membership: {
            _id: pmId,
            membership_plan_id:
              petMembership.membership_plan_id?.toString() ?? null,
            membership_name: (petMembership as any).membership?.name ?? null,
            start_date: petMembership.start_date,
            end_date: petMembership.end_date,
            status: this.computeStatus(
              petMembership.is_active,
              petMembership.start_date,
              petMembership.end_date,
            ),
          },
          benefits: await this.enrichBenefits(
            petMembership.benefits_snapshot || [],
            pmId,
            now,
            bookingDate,
          ),
        };
      }),
    );
  }

  async getBenefitsHistory(
    petId: string,
    options: { limit?: number; skip?: number } = {},
  ): Promise<any> {
    const activeMemberships = await this.getActiveMembership(petId);
    const hasActive = !!(activeMemberships && activeMemberships.length > 0);

    // Fetch ALL pet memberships for this pet (active + expired) to cover full history
    const allMemberships = await this.petMembershipModel
      .find({ pet_id: new Types.ObjectId(petId), isDeleted: false })
      .lean()
      .exec();

    if (allMemberships.length === 0) {
      return {
        has_active_membership: hasActive,
        benefits_history: [],
      };
    }

    // Collect usage records across all memberships
    const allUsage: any[] = [];
    for (const pm of allMemberships) {
      const usages = await this.benefitUsageService.getUsageHistory(
        pm._id.toString(),
        options,
      );
      for (const u of usages) {
        // Resolve benefit type (discount/quota) from the snapshot
        const snap = (pm.benefits_snapshot as any[]).find(
          (b) => b._id?.toString() === u.benefit_id?.toString(),
        );
        const booking: any =
          typeof u.booking_id === 'object' && u.booking_id !== null
            ? u.booking_id
            : null;
        const bookingId = booking?._id?.toString() ?? u.booking_id?.toString();
        allUsage.push({
          _id: u['_id']?.toString(),
          type: snap?.type ?? 'discount',
          applies_to: u.scope ?? snap?.applies_to ?? null,
          applied_date: u.used_at?.toISOString(),
          booking_id: bookingId,
          booking_date: booking?.date ?? null,
          booking_service: booking?.service_snapshot?.name ?? null,
          booking_status: booking?.booking_status ?? null,
          amount_deducted: u.amount_used,
        });
      }
    }

    // Sort newest first
    allUsage.sort(
      (a, b) =>
        new Date(b.applied_date).getTime() - new Date(a.applied_date).getTime(),
    );

    return {
      has_active_membership: hasActive,
      memberships: (activeMemberships ?? []).map((pm: any) => ({
        pet_membership_id: pm._id?.toString() || pm.id,
        status: this.computeStatus(pm.is_active, pm.start_date, pm.end_date),
      })),
      benefits_history: allUsage,
    };
  }

  async deductBenefitUsage(
    petMembershipId: string,
    benefitId: string,
    amountUsed: number,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(petMembershipId)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    if (!Types.ObjectId.isValid(benefitId)) {
      throw new BadRequestException('invalid benefit ID');
    }

    const petMembership = await this.findById(petMembershipId);
    const now = new Date();
    const benefitIndex = petMembership.benefits_snapshot.findIndex(
      (b) => b._id.toString() === benefitId,
    );

    if (benefitIndex === -1) {
      throw new BadRequestException('benefit not found in this membership');
    }

    const benefit = petMembership.benefits_snapshot[benefitIndex];

    // Check apakah period sudah reset
    const hasReset = this.shouldResetPeriod(
      benefit.period_reset_date,
      benefit.period,
      now,
    );
    if (hasReset) {
      benefit.used = 0;
      benefit.period_reset_date = this.calculateNextPeriodResetDate(
        now,
        benefit.period,
      );
    }

    // Validate dapat deduct atau tidak
    if (benefit.limit != null && benefit.used + amountUsed > benefit.limit) {
      throw new BadRequestException(
        `cannot deduct ${amountUsed} from benefit. limit: ${benefit.limit}, used: ${benefit.used}`,
      );
    }

    // Update used amount
    benefit.used += amountUsed;
    await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(petMembershipId),
      {
        benefits_snapshot: petMembership.benefits_snapshot,
      },
    );
  }

  async restoreBenefitUsage(
    petMembershipId: string,
    benefitId: string,
    amount: number = 1,
  ): Promise<void> {
    if (
      !Types.ObjectId.isValid(petMembershipId) ||
      !Types.ObjectId.isValid(benefitId)
    ) {
      return; // silently skip invalid refs (e.g. old bookings without IDs)
    }

    const petMembership = await this.petMembershipModel
      .findById(new Types.ObjectId(petMembershipId))
      .exec();
    if (!petMembership) return;

    const benefitIndex = petMembership.benefits_snapshot.findIndex(
      (b) => b._id.toString() === benefitId,
    );
    if (benefitIndex === -1) return; // benefit not found, skip silently

    const benefit = petMembership.benefits_snapshot[benefitIndex];
    benefit.used = Math.max(0, benefit.used - amount);

    await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(petMembershipId),
      { benefits_snapshot: petMembership.benefits_snapshot },
    );
  }

  async update(
    id: string,
    updatePetMembershipDto: UpdatePetMembershipDto,
  ): Promise<PetMembership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const existing = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!existing) {
      throw new NotFoundException('pet membership not found');
    }

    const newStartDate = new Date(updatePetMembershipDto.start_date);
    const newEndDate = new Date(updatePetMembershipDto.end_date);

    if (newEndDate <= newStartDate) {
      throw new BadRequestException(
        'Tanggal berakhir tidak boleh lebih kecil atau sama dengan tanggal mulai',
      );
    }

    // Block edit only if the new period overlaps with another active/pending membership
    // of the SAME plan. Excludes the membership being edited itself.
    const editOverlapBlock = await this.findMergedOverlap(
      existing.pet_id,
      existing.membership_plan_id,
      newStartDate,
      newEndDate,
      new Types.ObjectId(id),
    );

    if (editOverlapBlock) {
      const availableFrom = new Date(editOverlapBlock.blockedUntil);
      availableFrom.setDate(availableFrom.getDate() + 1);
      throw new BadRequestException(
        `Tanggal bertabrakan dengan "${editOverlapBlock.planName}" yang sudah ada. Tersedia mulai: ${availableFrom.toISOString().split('T')[0]}`,
      );
    }

    const petMembership = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        start_date: newStartDate,
        end_date: newEndDate,
      },
      { new: true, runValidators: true },
    );

    await this.createLog({
      pet_id: existing.pet_id,
      pet_membership_id: (existing as any)._id,
      membership_plan_id: existing.membership_plan_id,
      event_type: MembershipEventType.UPDATED,
      start_date: petMembership!.start_date,
      end_date: petMembership!.end_date,
      benefits_snapshot_before: [],
      note: updatePetMembershipDto.note ?? `-`,
    });

    return petMembership!;
  }

  async cancelled(id: string): Promise<PetMembership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    // Fetch first to capture snapshot before cancellation
    const existing = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
      is_active: true,
    });

    if (!existing) {
      throw new NotFoundException('pet membership not found');
    }

    const snapshotBefore = (existing as any).toObject().benefits_snapshot || [];

    const petMembership = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { is_active: false },
      { new: true },
    );

    await this.createLog({
      pet_id: existing.pet_id,
      pet_membership_id: (existing as any)._id,
      membership_plan_id: existing.membership_plan_id,
      event_type: MembershipEventType.CANCELLED,
      start_date: existing.start_date,
      end_date: existing.end_date,
      benefits_snapshot_before: snapshotBefore,
      cancelled_at: new Date(),
    });

    return petMembership!;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    // Fetch first to capture snapshot before cancellation
    const existing = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!existing) {
      throw new NotFoundException('pet membership not found');
    }

    const pet_membership = await this.petMembershipModel.findByIdAndUpdate(id, {
      isDeleted: true,
      is_active: false,
      deletedAt: new Date(),
    });

    return pet_membership;
  }

  async renew(id: string, dto: RenewPetMembershipDto = {}): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const existing = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
      is_active: true,
    });

    if (!existing) {
      throw new NotFoundException('pet membership not found');
    }

    const now = new Date();
    const todayStart = this.startOfDayUtc(now);
    // hanya bisa diperpanjang jika sudah expired (end_date sebelum hari ini)
    if (existing.end_date >= todayStart) {
      throw new BadRequestException(
        'membership is still active and cannot be renewed yet',
      );
    }

    const membership = await this.membershipModel.findOne({
      _id: existing.membership_plan_id,
      isDeleted: false,
    });

    if (!membership) {
      throw new BadRequestException('membership plan not found');
    }

    // Snapshot the current pet-membership benefits (with final used counts) before reset
    const snapshotBefore = (existing as any).toObject().benefits_snapshot || [];

    // New period: use dto.start_date if provided, otherwise start from today
    const newStartDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + membership.duration_months);

    // Block renewal only if the new period overlaps with another active/pending membership
    // of the SAME plan. Excludes the membership being renewed itself; uses merged-period logic.
    const renewOverlapBlock = await this.findMergedOverlap(
      existing.pet_id,
      existing.membership_plan_id,
      newStartDate,
      newEndDate,
      new Types.ObjectId(id),
    );

    if (renewOverlapBlock) {
      const availableFrom = new Date(renewOverlapBlock.blockedUntil);
      availableFrom.setDate(availableFrom.getDate() + 1);
      throw new BadRequestException(
        `Tanggal perpanjangan bertabrakan dengan "${renewOverlapBlock.planName}" yang sudah ada. Membership tersedia mulai: ${availableFrom.toISOString().split('T')[0]}`,
      );
    }

    // Rebuild benefits snapshot fresh from membership plan (same as create)
    const resetSnapshot = membership.benefits.map((b) => ({
      _id: b._id,
      applies_to: b.applies_to,
      service_id: b.service_id,
      label: b.label,
      type: b.type,
      period: b.period,
      limit: b.limit,
      value: b.value,
      used: 0,
      period_reset_date: this.calculateNextPeriodResetDate(
        newStartDate,
        b.period,
      ),
    }));

    const updateData: Record<string, unknown> = {
      start_date: newStartDate,
      end_date: newEndDate,
      benefits_snapshot: resetSnapshot,
      base_price: membership.price,
      purchase_price:
        dto.purchase_price != null ? dto.purchase_price : membership.price,
    };

    const updated = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      updateData,
      { new: true },
    );

    await this.createLog({
      pet_id: existing.pet_id,
      pet_membership_id: (existing as any)._id,
      membership_plan_id: existing.membership_plan_id,
      event_type: MembershipEventType.RENEWED,
      start_date: newStartDate,
      end_date: newEndDate,
      benefits_snapshot_before: snapshotBefore,
      note: `Renewed from ${existing.end_date.toISOString()} to ${newEndDate.toISOString()}`,
    });

    return updated;
  }

  async getMembershipHistory(petId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }

    const results = await this.membershipLogModel
      .find({ pet_id: new Types.ObjectId(petId), isDeleted: false })
      .populate('membership', 'name description duration_months price')
      .sort({ event_date: -1 })
      .lean({ virtuals: true })
      .exec();

    return results;
  }

  async getMembershipHistoryDetail(
    petId: string,
    petMembershipId: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }
    if (!Types.ObjectId.isValid(petMembershipId)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const petMembership = await this.petMembershipModel
      .findOne({
        _id: new Types.ObjectId(petMembershipId),
        pet_id: new Types.ObjectId(petId),
      })
      .populate('membership', 'name description duration_months price')
      .select('-benefits_snapshot')
      .lean({ virtuals: true })
      .exec();

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    const enrichedPetMembership = {
      ...(petMembership as any),
      status: this.computeStatus(
        (petMembership as any).is_active,
        (petMembership as any).start_date,
        (petMembership as any).end_date,
      ),
    };

    const logs = await this.membershipLogModel
      .find({
        pet_id: new Types.ObjectId(petId),
        pet_membership_id: new Types.ObjectId(petMembershipId),
        membership_plan_id: (petMembership as any).membership_plan_id,
        isDeleted: false,
      })
      .populate('membership', 'name description duration_months price')
      .sort({ event_date: -1 })
      .lean({ virtuals: true })
      .exec();

    return {
      pet_membership: enrichedPetMembership,
      logs,
    };
  }

  /**
   * Update benefits_snapshot for all active & pending pet memberships of a given plan.
   * Preserves usage tracking (used, period_reset_date) for benefits with matching _id.
   */
  async updateBenefitsFromPlan(
    membershipPlanId: string,
    newBenefits: any[],
  ): Promise<number> {
    const now = new Date();
    const todayStart = this.startOfDayUtc(now);

    // Find all active + pending pet memberships for this plan
    const petMemberships = await this.petMembershipModel.find({
      membership_plan_id: new Types.ObjectId(membershipPlanId),
      is_active: true,
      end_date: { $gte: todayStart }, // active or pending (not expired)
      isDeleted: false,
    });

    let updatedCount = 0;

    for (const pm of petMemberships) {
      const oldSnapshot = pm.benefits_snapshot || [];

      // Build a map of old benefits by _id for preserving usage
      const oldBenefitMap = new Map<string, any>();
      for (const ob of oldSnapshot) {
        oldBenefitMap.set(ob._id?.toString(), ob);
      }

      // Create new benefits snapshot, preserving usage for matching benefit IDs
      const newSnapshot = newBenefits.map((b: any) => {
        const existingBenefit = b._id
          ? oldBenefitMap.get(b._id.toString())
          : null;

        return {
          _id: b._id || new Types.ObjectId(),
          applies_to: b.applies_to,
          service_id: b.service_id || undefined,
          label: b.label || undefined,
          type: b.type,
          period: b.period || 'unlimited',
          limit: b.limit,
          value: b.value,
          used: existingBenefit ? existingBenefit.used : 0,
          period_reset_date: existingBenefit
            ? existingBenefit.period_reset_date
            : this.calculateNextPeriodResetDate(
                pm.start_date,
                b.period || 'unlimited',
              ),
        };
      });

      // Log the update
      await this.createLog({
        pet_id: pm.pet_id,
        pet_membership_id: (pm as any)._id,
        membership_plan_id: pm.membership_plan_id,
        event_type: MembershipEventType.UPDATED,
        start_date: pm.start_date,
        end_date: pm.end_date,
        benefits_snapshot_before: oldSnapshot as any[],
        note: 'Benefit diperbarui secara retroaktif dari perubahan paket membership',
      });

      // Update the benefits snapshot
      pm.benefits_snapshot = newSnapshot as any;
      await pm.save();
      updatedCount++;
    }

    return updatedCount;
  }

  private async createLog(data: {
    pet_id: Types.ObjectId;
    pet_membership_id: Types.ObjectId;
    membership_plan_id: Types.ObjectId;
    event_type: MembershipEventType;
    start_date: Date;
    end_date: Date;
    benefits_snapshot_before?: any[];
    purchase_price?: number;
    note?: string;
    cancelled_at?: Date;
  }): Promise<void> {
    await this.membershipLogModel.create({
      ...data,
      event_date: new Date(),
    });
  }

  private async enrichBenefits(
    benefitsSnapshot: any[],
    petMembershipId: string,
    now: Date,
    bookingDate?: Date,
    excludeBookingId?: string,
  ): Promise<any[]> {
    return Promise.all(
      benefitsSnapshot.map(async (b: any) => {
        let currentUsed: number;
        let remaining: number | null;

        if (bookingDate) {
          // Per-period count from benefitusages collection
          const periodKey = BenefitUsageService.computePeriodKey(
            bookingDate,
            b.period as BenefitPeriod,
          );
          currentUsed = await this.benefitUsageService.getUsedInPeriod(
            petMembershipId,
            b._id.toString(),
            periodKey,
            excludeBookingId,
          );
          remaining = b.limit == null ? null : b.limit - currentUsed;
        } else {
          // Fallback: legacy snapshot counter (used when no bookingDate provided)
          const hasReset = this.shouldResetPeriod(
            b.period_reset_date,
            b.period,
            now,
          );
          currentUsed = hasReset ? 0 : b.used;
          remaining = b.limit == null ? null : b.limit - currentUsed;
        }

        return {
          _id: b._id.toString(),
          pet_membership_id: petMembershipId,
          applies_to: b.applies_to,
          service_id: b.service_id?.toString() ?? null,
          label: b.label ?? null,
          service: b.service ?? null,
          type: b.type,
          period: b.period,
          limit: b.limit ?? null,
          value: b.value ?? null,
          used: currentUsed,
          remaining,
          can_apply: b.limit == null || (remaining !== null && remaining > 0),
          period_reset_date: b.period_reset_date ?? null,
          next_reset_date: this.calculateNextPeriodResetDate(
            b.period_reset_date,
            b.period,
          ),
        };
      }),
    );
  }

  /**
   * Hitung kapan period reset selanjutnya berdasarkan periode type
   */
  private calculateNextPeriodResetDate(
    baseDate: Date | null,
    period: BenefitPeriod,
  ): Date | null {
    if (!baseDate || period === BenefitPeriod.UNLIMITED || period === BenefitPeriod.ONCE) {
      return null;
    }

    const resetDate = new Date(baseDate);

    if (period === BenefitPeriod.WEEKLY) {
      // Reset setiap Senin (hari ke-1 minggu)
      resetDate.setDate(
        resetDate.getDate() + ((8 - resetDate.getDay()) % 7 || 7),
      );
      resetDate.setHours(0, 0, 0, 0);
    } else if (period === BenefitPeriod.MONTHLY) {
      // Reset pada hari 1 setiap bulan
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);
    }

    return resetDate;
  }

  /**
   * Cek apakah period sudah expired dan perlu reset
   */
  private shouldResetPeriod(
    lastResetDate: Date | null,
    period: BenefitPeriod,
    now: Date,
  ): boolean {
    if (!lastResetDate || period === BenefitPeriod.UNLIMITED || period === BenefitPeriod.ONCE) {
      return false;
    }

    return now >= lastResetDate;
  }

  /**
   * Populate service details in benefits_snapshot array
   */
  private async populateBenefitsWithServices(
    petMemberships: PetMembership | PetMembership[],
  ): Promise<any | any[]> {
    const isArray = Array.isArray(petMemberships);
    const docs = isArray ? petMemberships : [petMemberships];

    // Convert all Mongoose documents to plain objects
    const plainDocs = docs.map((doc: any) =>
      typeof doc.toObject === 'function' ? doc.toObject() : { ...doc },
    );

    // Extract unique service_ids
    const serviceIds = new Set<string>();
    plainDocs.forEach((doc) => {
      if (doc.benefits_snapshot) {
        doc.benefits_snapshot.forEach((benefit: any) => {
          if (benefit.service_id) {
            serviceIds.add(benefit.service_id.toString());
          }
        });
      }
    });

    // Fetch all services if there are any service_ids
    const serviceMap = new Map<string, any>();
    if (serviceIds.size > 0) {
      const services = await this.serviceModel
        .find({
          _id: {
            $in: Array.from(serviceIds).map((id) => new Types.ObjectId(id)),
          },
        })
        .select('_id code name price description service_location_type')
        .lean()
        .exec();

      services.forEach((service: any) => {
        serviceMap.set(service._id.toString(), service);
      });
    }

    // Add service object to each benefit in plain docs, and compute status
    plainDocs.forEach((doc) => {
      if (doc.benefits_snapshot) {
        doc.benefits_snapshot = doc.benefits_snapshot.map((benefit: any) => ({
          ...benefit,
          service: benefit.service_id
            ? (serviceMap.get(benefit.service_id.toString()) ?? null)
            : null,
        }));
      }
      doc.status = this.computeStatus(
        doc.is_active,
        doc.start_date,
        doc.end_date,
      );
    });

    return isArray ? plainDocs : plainDocs[0];
  }

  /**
   * Fetch all active/pending memberships for a pet **dengan plan yang sama**,
   * merge consecutive/overlapping periods, dan kembalikan blok yang konflik
   * dengan [checkStart, checkEnd]. Membership dengan plan berbeda diabaikan
   * sehingga pet boleh punya beberapa plan berbeda dalam periode yang overlap.
   * Expired memberships (end_date sebelum hari ini) are excluded.
   */
  private async findMergedOverlap(
    petId: Types.ObjectId,
    membershipPlanId: Types.ObjectId,
    checkStart: Date,
    checkEnd: Date,
    excludeId?: Types.ObjectId,
  ): Promise<{ blockedUntil: Date; planName: string } | null> {
    const now = new Date();
    const todayStart = this.startOfDayUtc(now);
    const query: any = {
      pet_id: petId,
      membership_plan_id: membershipPlanId,
      is_active: true,
      isDeleted: false,
      end_date: { $gte: todayStart }, // active or pending only (exclude expired)
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const memberships = await this.petMembershipModel
      .find(query)
      .sort({ start_date: 1 })
      .lean()
      .exec() as any[];

    if (!memberships.length) return null;

    // Merge consecutive / overlapping periods.
    // Periods starting within 1 day after the previous end are treated as consecutive
    // (e.g. active ends Nov 16, pending starts Nov 17 → same block).
    const MS_PER_DAY = 86_400_000;
    const merged: { start: Date; end: Date; planId: Types.ObjectId }[] = [];
    for (const m of memberships) {
      const s = new Date(m.start_date);
      const e = new Date(m.end_date);
      if (merged.length === 0) {
        merged.push({ start: s, end: e, planId: m.membership_plan_id });
      } else {
        const lastEnd = merged[merged.length - 1].end;
        const isConsecutive = s.getTime() <= lastEnd.getTime() + MS_PER_DAY;
        if (!isConsecutive) {
          merged.push({ start: s, end: e, planId: m.membership_plan_id });
        } else if (e > lastEnd) {
          merged[merged.length - 1].end = e;
        }
      }
    }

    // Conflict if the start date falls inside a block, OR the full range overlaps it.
    const block = merged.find((p) => {
      const startInside = checkStart >= p.start && checkStart < p.end;
      const rangeOverlap = checkStart < p.end && checkEnd > p.start;
      return startInside || rangeOverlap;
    });
    if (!block) return null;

    const plan = await this.membershipModel
      .findById(block.planId)
      .select('name')
      .lean();

    return {
      blockedUntil: block.end,
      planName: (plan as any)?.name ?? 'membership lain',
    };
  }

  /**
   * Awal hari (00:00:00.000) dalam UTC. Dipakai untuk membandingkan end_date
   * berbasis tanggal-kalender: membership tetap aktif sepanjang hari end_date,
   * baru "expired" mulai hari berikutnya. Pakai UTC karena start_date/end_date
   * disimpan pada 00:00 UTC (FE mengirim ISO dari input tanggal).
   */
  private startOfDayUtc(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  }

  private computeStatus(
    isActive: boolean,
    startDate: Date,
    endDate: Date,
  ): 'active' | 'expired' | 'pending' | 'cancelled' {
    if (!isActive) return 'cancelled';
    const now = new Date();
    const todayStart = this.startOfDayUtc(now);
    if (now < new Date(startDate)) return 'pending';
    // expired hanya jika end_date sudah lewat sebelum hari ini (inklusif sepanjang hari end_date)
    if (new Date(endDate) < todayStart) return 'expired';
    return 'active';
  }

  private canApplyBenefit(benefit: any): boolean {
    // Can apply if limit is -1 (unlimited) or used < limit
    return benefit.limit === -1 || benefit.used < benefit.limit;
  }

  /**
   * Batch-fetch all pet memberships (active = true, not deleted) for the given
   * pet IDs. Returns a Map keyed by pet-id string, where each value is an
   * array of { name, start_date, end_date } — one entry per membership record.
   *
   * Callers can then filter per booking-date in JS without extra DB round-trips.
   */
  async getActiveMembershipsForPets(
    petIds: string[],
  ): Promise<
    Map<string, { name: string; start_date: Date; end_date: Date }[]>
  > {
    const result = new Map<
      string,
      { name: string; start_date: Date; end_date: Date }[]
    >();
    if (!petIds.length) return result;

    const records = await this.petMembershipModel
      .find({
        pet_id: { $in: petIds.map((id) => new Types.ObjectId(id)) },
        is_active: true,
        isDeleted: false,
      })
      .populate('membership_plan_id', 'name')
      .lean()
      .exec();

    for (const pm of records as any[]) {
      const petIdStr = pm.pet_id?.toString();
      if (!petIdStr) continue;
      if (!result.has(petIdStr)) result.set(petIdStr, []);
      result.get(petIdStr)!.push({
        name: pm.membership_plan_id?.name ?? 'Unknown',
        start_date: pm.start_date,
        end_date: pm.end_date,
      });
    }
    return result;
  }
}
