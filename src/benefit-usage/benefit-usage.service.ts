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

@Injectable()
export class BenefitUsageService {
  constructor(
    @InjectModel(BenefitUsage.name)
    private benefitUsageModel: Model<BenefitUsageDocument>,
    @InjectModel(PetMembership.name)
    private petMembershipModel: Model<PetMembershipDocument>,
  ) {}

  async recordUsage(
    createBenefitUsageDto: CreateBenefitUsageDto,
  ): Promise<BenefitUsage> {
    const {
      pet_membership_id,
      benefit_id,
      booking_id,
      target_id,
      amount_used,
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
