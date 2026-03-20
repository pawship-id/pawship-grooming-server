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

    return petMembership.save();
  }

  async findAll(query: GetPetMembershipQueryDto): Promise<any[]> {
    const conditions: any = { isDeleted: false };

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

    // Filter by is_active (date range check in virtual field)
    if (query.is_active !== undefined) {
      const now = new Date();
      if (query.is_active) {
        petMemberships = petMemberships.filter(
          (pm) => now >= pm.start_date && now <= pm.end_date,
        );
      } else {
        petMemberships = petMemberships.filter(
          (pm) => now < pm.start_date || now > pm.end_date,
        );
      }
    }

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
      membership_ids: activeMemberships.map(
        (pm: any) => pm._id?.toString() || pm.id,
      ),
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

    const petMembership = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      updatePetMembershipDto,
      { new: true, runValidators: true },
    );

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    return petMembership;
  }

  async delete(id: string): Promise<PetMembership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const petMembership = await this.petMembershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    return petMembership;
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

    // Add service object to each benefit in plain docs
    plainDocs.forEach((doc) => {
      if (doc.benefits_snapshot) {
        doc.benefits_snapshot = doc.benefits_snapshot.map((benefit: any) => ({
          ...benefit,
          service: benefit.service_id
            ? (serviceMap.get(benefit.service_id.toString()) ?? null)
            : null,
        }));
      }
    });

    return isArray ? plainDocs : plainDocs[0];
  }

  private canApplyBenefit(benefit: any): boolean {
    // Can apply if limit is -1 (unlimited) or used < limit
    return benefit.limit === -1 || benefit.used < benefit.limit;
  }
}
