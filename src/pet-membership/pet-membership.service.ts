import {
  Injectable,
  BadRequestException,
  NotFoundException,
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
import { CreatePetMembershipDto } from './dto/create-pet-membership.dto';
import { UpdatePetMembershipDto } from './dto/update-pet-membership.dto';
import { GetPetMembershipQueryDto } from './dto/get-pet-membership-query.dto';

@Injectable()
export class PetMembershipService {
  constructor(
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
    @InjectModel(MembershipLog.name)
    private membershipLogModel: Model<MembershipLogDocument>,
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
    @InjectModel(Service.name)
    private serviceModel: Model<ServiceDocument>,
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

    // Block purchase if pet already has this plan and it's still active (not cancelled)
    const existingActive = await this.petMembershipModel.findOne({
      pet_id: new Types.ObjectId(pet_id),
      membership_plan_id: new Types.ObjectId(membership_plan_id),
      is_active: true,
      isDeleted: false,
    });

    if (existingActive) {
      throw new BadRequestException(
        'pet already has an active membership for this plan',
      );
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + membership.duration_months);

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

    const petMembership = new this.petMembershipModel({
      pet_id: new Types.ObjectId(pet_id),
      membership_plan_id: new Types.ObjectId(membership_plan_id),
      start_date: startDate,
      end_date: endDate,
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
      benefits_snapshot_before: benefitsSnapshot,
    });

    return saved;
  }

  async findAll(query: GetPetMembershipQueryDto): Promise<any[]> {
    const conditions: any = { isDeleted: false, is_active: true };

    if (query.pet_id) {
      conditions.pet_id = new Types.ObjectId(query.pet_id);
    }

    if (query.membership_plan_id) {
      conditions.membership_plan_id = new Types.ObjectId(
        query.membership_plan_id,
      );
    }

    let petMemberships = await this.petMembershipModel
      .find(conditions)
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
      .populate('membership', 'name description duration_months price')
      .exec();

    // Populate services in benefits_snapshot
    return this.populateBenefitsWithServices(petMemberships);
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

  async getActiveMembership(petId: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }

    const now = new Date();
    const petMembership = await this.petMembershipModel
      .find({
        pet_id: new Types.ObjectId(petId),
        start_date: { $lte: now },
        end_date: { $gte: now },
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

  async getAvailableBenefits(petId: string): Promise<any> {
    const activeMemberships = await this.getActiveMembership(petId);

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

      const benefits = this.enrichBenefits(
        petMembership.benefits_snapshot || [],
        pmId,
        now,
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

  async getBenefitsSummary(petId: string): Promise<any[]> {
    const activeMemberships = await this.getActiveMembership(petId);

    if (!activeMemberships) {
      return [];
    }

    const now = new Date();

    return activeMemberships.map((petMembership: any) => {
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
        benefits: this.enrichBenefits(
          petMembership.benefits_snapshot || [],
          pmId,
          now,
        ),
      };
    });
  }

  async getBenefitsHistory(
    petId: string,
    options: { limit?: number; skip?: number } = {},
  ): Promise<any> {
    const activeMemberships = await this.getActiveMembership(petId);

    if (!activeMemberships) {
      return {
        has_active_membership: false,
        benefits_history: [],
      };
    }

    // Would integrate with BenefitUsageService here
    // For now, return structure
    return {
      has_active_membership: true,
      memberships: activeMemberships.map((pm: any) => ({
        pet_membership_id: pm._id?.toString() || pm.id,
        status: this.computeStatus(pm.is_active, pm.start_date, pm.end_date),
      })),
      benefits_history: [],
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

    const petMembership = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        start_date: new Date(updatePetMembershipDto.start_date),
        end_date: new Date(updatePetMembershipDto.end_date),
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
      note: `Updated dates: start=${petMembership!.start_date.toISOString()}, end=${petMembership!.end_date.toISOString()}`,
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

  async renew(id: string): Promise<any> {
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
    if (existing.end_date >= now) {
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

    // New period: contiguous from new Date
    const newStartDate = new Date();
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + membership.duration_months);

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

    const updated = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        start_date: newStartDate,
        end_date: newEndDate,
        benefits_snapshot: resetSnapshot,
      },
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

    const results = await this.petMembershipModel
      .find({ pet_id: new Types.ObjectId(petId), isDeleted: false })
      .populate('membership', 'name description duration_months price')
      .select('-benefits_snapshot')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true })
      .exec();

    return results.map((pm: any) => ({
      ...pm,
      status: this.computeStatus(pm.is_active, pm.start_date, pm.end_date),
    }));
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

  private async createLog(data: {
    pet_id: Types.ObjectId;
    pet_membership_id: Types.ObjectId;
    membership_plan_id: Types.ObjectId;
    event_type: MembershipEventType;
    start_date: Date;
    end_date: Date;
    benefits_snapshot_before?: any[];
    note?: string;
  }): Promise<void> {
    await this.membershipLogModel.create({
      ...data,
      event_date: new Date(),
    });
  }

  private enrichBenefits(
    benefitsSnapshot: any[],
    petMembershipId: string,
    now: Date,
  ): any[] {
    return benefitsSnapshot.map((b: any) => {
      const hasReset = this.shouldResetPeriod(
        b.period_reset_date,
        b.period,
        now,
      );
      const currentUsed = hasReset ? 0 : b.used;
      const remaining = b.limit == null ? null : b.limit - currentUsed;

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
        can_apply: b.limit == null || currentUsed < b.limit,
        period_reset_date: b.period_reset_date ?? null,
        next_reset_date: this.calculateNextPeriodResetDate(
          b.period_reset_date,
          b.period,
        ),
      };
    });
  }

  /**
   * Hitung kapan period reset selanjutnya berdasarkan periode type
   */
  private calculateNextPeriodResetDate(
    baseDate: Date | null,
    period: BenefitPeriod,
  ): Date | null {
    if (!baseDate || period === BenefitPeriod.UNLIMITED) {
      return null;
    }

    const resetDate = new Date(baseDate);

    if (period === BenefitPeriod.WEEKLY) {
      // Reset setiap Senin (hari ke-1 minggu)
      resetDate.setDate(resetDate.getDate() + ((8 - resetDate.getDay()) % 7));
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
    if (!lastResetDate || period === BenefitPeriod.UNLIMITED) {
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

  private computeStatus(
    isActive: boolean,
    startDate: Date,
    endDate: Date,
  ): 'active' | 'expired' | 'pending' | 'cancelled' {
    if (!isActive) return 'cancelled';
    const now = new Date();
    if (now < new Date(startDate)) return 'pending';
    if (now > new Date(endDate)) return 'expired';
    return 'active';
  }

  private canApplyBenefit(benefit: any): boolean {
    // Can apply if limit is -1 (unlimited) or used < limit
    return benefit.limit === -1 || benefit.used < benefit.limit;
  }
}
