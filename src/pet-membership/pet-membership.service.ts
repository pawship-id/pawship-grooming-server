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
        type: b.type,
        applies_to: b.applies_to,
        period: b.period,
        value: b.value,
        service_id: b.service_id,
        limit: b.limit,
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

  async findAll(query: GetPetMembershipQueryDto): Promise<PetMembership[]> {
    const conditions: any = { isDeleted: false };

    if (query.pet_id) {
      conditions.pet_id = new Types.ObjectId(query.pet_id);
    }

    if (query.membership_plan_id) {
      conditions.membership_plan_id = new Types.ObjectId(
        query.membership_plan_id,
      );
    }

    let petMemberships = await this.petMembershipModel.find(conditions).exec();

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

    return petMemberships;
  }

  async findById(id: string): Promise<PetMembership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const petMembership = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    return petMembership;
  }

  async getActiveMembership(petId: string): Promise<PetMembership | null> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new BadRequestException('invalid pet ID');
    }

    const now = new Date();
    const petMembership = await this.petMembershipModel.findOne({
      pet_id: new Types.ObjectId(petId),
      start_date: { $lte: now },
      end_date: { $gte: now },
      isDeleted: false,
    });

    return petMembership || null;
  }

  async getAvailableBenefits(petId: string): Promise<any> {
    const petMembership = await this.getActiveMembership(petId);

    if (!petMembership) {
      return {
        has_active_membership: false,
        benefits: [],
      };
    }

    const now = new Date();
    const benefits = petMembership.benefits_snapshot.map((b) => {
      // Cek apakah period sudah reset
      const hasResetSincePeriod = this.shouldResetPeriod(
        b.period_reset_date,
        b.period,
        now,
      );
      const currentUsed = hasResetSincePeriod ? 0 : b.used;
      const remaining = b.limit === -1 ? -1 : b.limit - currentUsed;

      return {
        _id: b._id.toString(),
        type: b.type,
        applies_to: b.applies_to,
        period: b.period,
        value: b.value,
        service_id: b.service_id?.toString(),
        limit: b.limit,
        used: currentUsed,
        remaining,
        can_apply: b.limit === -1 || currentUsed < b.limit,
        period_reset_date: b.period_reset_date,
        next_reset_date: this.calculateNextPeriodResetDate(
          b.period_reset_date,
          b.period,
        ),
      };
    });

    const petMembershipAny = petMembership as any;
    const petMembershipId =
      petMembershipAny.toObject()._id?.toString() || petMembershipAny.id;
    return {
      has_active_membership: true,
      pet_membership_id: petMembershipId,
      membership_plan_id: petMembership.membership_plan_id.toString(),
      start_date: petMembership.start_date,
      end_date: petMembership.end_date,
      benefits,
    };
  }

  async getBenefitsSummary(petId: string): Promise<any> {
    return this.getAvailableBenefits(petId);
  }

  async getBenefitsHistory(
    petId: string,
    options: { limit?: number; skip?: number } = {},
  ): Promise<any> {
    const petMembership = await this.getActiveMembership(petId);

    if (!petMembership) {
      return {
        has_active_membership: false,
        benefits_history: [],
      };
    }

    // Would integrate with BenefitUsageService here
    // For now, return structure
    const petMembershipAny = petMembership as any;
    const petMembershipId =
      petMembershipAny.toObject()._id?.toString() || petMembershipAny.id;
    return {
      has_active_membership: true,
      pet_membership_id: petMembershipId,
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
    if (benefit.limit !== -1 && benefit.used + amountUsed > benefit.limit) {
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

  private canApplyBenefit(benefit: any): boolean {
    // Can apply if limit is -1 (unlimited) or used < limit
    return benefit.limit === -1 || benefit.used < benefit.limit;
  }
}
