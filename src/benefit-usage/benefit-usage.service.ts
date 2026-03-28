import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BenefitUsage,
  BenefitUsageDocument,
} from './entities/benefit-usage.entity';
import {
  PetMembership,
  PetMembershipDocument,
} from '../pet-membership/entities/pet-membership.entity';
import { CreateBenefitUsageDto } from './dto/create-benefit-usage.dto';
import { GetBenefitUsageQueryDto } from './dto/get-benefit-usage-query.dto';
import { BenefitPeriod } from 'src/membership/entities/membership.entity';

@Injectable()
export class BenefitUsageService {
  constructor(
    @InjectModel(BenefitUsage.name)
    private benefitUsageModel: Model<BenefitUsageDocument>,
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
  ) {}

  /**
   * Compute the period slot key for a given date and period type.
   * - weekly   → "YYYY-WNN"  (ISO week number, Monday-based)
   * - monthly  → "YYYY-MM"
   * - unlimited → null
   */
  static computePeriodKey(date: Date, period: BenefitPeriod): string | null {
    if (period === BenefitPeriod.UNLIMITED) return null;

    if (period === BenefitPeriod.MONTHLY) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }

    // WEEKLY: ISO week (Monday = day 1)
    // Algorithm: shift to Thursday of the same week → that Thursday's year/week
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Day of week: 0=Sun … 6=Sat → shift so Mon=0 … Sun=6
    const day = (d.getUTCDay() + 6) % 7;
    // Thursday of the same ISO week
    d.setUTCDate(d.getUTCDate() - day + 3);
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const weekNum = Math.round(
      ((d.getTime() - jan4.getTime()) / 86_400_000 + ((jan4.getUTCDay() + 6) % 7)) / 7,
    );
    const week = String(weekNum).padStart(2, '0');
    return `${d.getUTCFullYear()}-W${week}`;
  }

  /**
   * Count active (non-deleted) usages for a benefit in a given period slot.
   * For unlimited benefits (periodKey = null), counts all non-deleted usages.
   */
  async getUsedInPeriod(
    petMembershipId: string,
    benefitId: string,
    periodKey: string | null,
  ): Promise<number> {
    const query: any = {
      pet_membership_id: new Types.ObjectId(petMembershipId),
      benefit_id: new Types.ObjectId(benefitId),
      isDeleted: false,
    };

    if (periodKey !== null) {
      query.period_key = periodKey;
    }

    return this.benefitUsageModel.countDocuments(query).exec();
  }

  /**
   * Soft-delete all BenefitUsage records for a booking (restores quota on cancel).
   */
  async softDeleteByBookingId(bookingId: string): Promise<void> {
    if (!Types.ObjectId.isValid(bookingId)) return;
    await this.benefitUsageModel.updateMany(
      { booking_id: new Types.ObjectId(bookingId), isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
  }

  async recordUsage(
    createBenefitUsageDto: CreateBenefitUsageDto,
  ): Promise<BenefitUsage> {
    const {
      pet_membership_id,
      benefit_id,
      booking_id,
      target_id,
      amount_used,
      booking_date,
      period_key,
      benefit_period,
    } = createBenefitUsageDto;

    // Validate pet membership exists
    if (!Types.ObjectId.isValid(pet_membership_id)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const petMembership = await this.petMembershipModel.findOne({
      _id: new Types.ObjectId(pet_membership_id),
      isDeleted: false,
    });

    if (!petMembership) {
      throw new NotFoundException('pet membership not found');
    }

    // Find benefit in benefits_snapshot
    const benefitSnapshot = petMembership.benefits_snapshot.find(
      (b) => b._id.toString() === benefit_id,
    );

    if (!benefitSnapshot) {
      throw new BadRequestException('benefit not found in this membership');
    }

    // Auto-derive scope from benefit.applies_to
    const scope = benefitSnapshot.applies_to;

    const benefitUsage = new this.benefitUsageModel({
      pet_membership_id: new Types.ObjectId(pet_membership_id),
      benefit_id: new Types.ObjectId(benefit_id),
      booking_id: new Types.ObjectId(booking_id),
      used_at: new Date(),
      scope,
      target_id: new Types.ObjectId(target_id),
      amount_used,
      booking_date: new Date(booking_date),
      period_key: period_key ?? null,
      benefit_period,
    });

    return benefitUsage.save();
  }

  async getUsageHistory(
    petMembershipId: string,
    options: { limit?: number; skip?: number } = {},
  ): Promise<BenefitUsage[]> {
    if (!Types.ObjectId.isValid(petMembershipId)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    const limit = options.limit || 100;
    const skip = options.skip || 0;

    return this.benefitUsageModel
      .find({
        pet_membership_id: new Types.ObjectId(petMembershipId),
        isDeleted: false,
      })
      .sort({ used_at: -1 })
      .limit(limit)
      .skip(skip)
      .populate('booking_id')
      .exec();
  }

  async getTotalUsed(
    petMembershipId: string,
    benefitId: string,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(petMembershipId)) {
      throw new BadRequestException('invalid pet membership ID');
    }

    if (!Types.ObjectId.isValid(benefitId)) {
      throw new BadRequestException('invalid benefit ID');
    }

    const result = await this.benefitUsageModel.aggregate([
      {
        $match: {
          pet_membership_id: new Types.ObjectId(petMembershipId),
          benefit_id: new Types.ObjectId(benefitId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount_used' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  async findAll(query: GetBenefitUsageQueryDto): Promise<BenefitUsage[]> {
    const conditions: any = { isDeleted: false };

    if (query.pet_membership_id) {
      conditions.pet_membership_id = new Types.ObjectId(
        query.pet_membership_id,
      );
    }

    if (query.booking_id) {
      conditions.booking_id = new Types.ObjectId(query.booking_id);
    }

    return this.benefitUsageModel
      .find(conditions)
      .sort({ created_at: -1 })
      .populate('booking_id')
      .exec();
  }

  async findById(id: string): Promise<BenefitUsage> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid benefit usage ID');
    }

    const benefitUsage = await this.benefitUsageModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!benefitUsage) {
      throw new NotFoundException('benefit usage not found');
    }

    return benefitUsage;
  }

  async delete(id: string): Promise<BenefitUsage> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid benefit usage ID');
    }

    const benefitUsage = await this.benefitUsageModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );

    if (!benefitUsage) {
      throw new NotFoundException('benefit usage not found');
    }

    return benefitUsage;
  }
}
