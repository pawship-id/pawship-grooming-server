import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PromotionLimitType,
  PromotionUsagePeriod,
} from 'src/promotion/dto/create-promotion.dto';
import {
  PromotionUsage,
  PromotionUsageDocument,
} from './entities/promotion-usage.entity';

@Injectable()
export class PromotionUsageService {
  constructor(
    @InjectModel(PromotionUsage.name)
    private readonly promotionUsageModel: Model<PromotionUsageDocument>,
  ) {}

  static computePeriodKey(
    date: Date,
    period: PromotionUsagePeriod,
  ): string | null {
    if (period === PromotionUsagePeriod.LIFETIME) return null;

    if (period === PromotionUsagePeriod.DAILY) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    if (period === PromotionUsagePeriod.MONTHLY) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }

    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const day = (utcDate.getUTCDay() + 6) % 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - day + 3);
    const jan4 = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 4));
    const weekNum = Math.round(
      ((utcDate.getTime() - jan4.getTime()) / 86_400_000 +
        ((jan4.getUTCDay() + 6) % 7)) /
        7,
    );
    const week = String(weekNum).padStart(2, '0');
    return `${utcDate.getUTCFullYear()}-W${week}`;
  }

  async getUsedCount(params: {
    promotionId: string;
    limitType: PromotionLimitType;
    userId?: string;
    petId?: string;
    periodKey: string | null;
    excludeBookingId?: string;
  }): Promise<number> {
    const query: any = {
      promotion_id: new Types.ObjectId(params.promotionId),
      isDeleted: false,
    };

    if (params.limitType === PromotionLimitType.PER_USER) {
      if (!params.userId || !Types.ObjectId.isValid(params.userId)) {
        throw new BadRequestException(
          'customer_id is required for user-limited promotion',
        );
      }
      query.user_id = new Types.ObjectId(params.userId);
    }

    if (params.limitType === PromotionLimitType.PER_PET) {
      if (!params.petId || !Types.ObjectId.isValid(params.petId)) {
        throw new BadRequestException(
          'pet_id is required for pet-limited promotion',
        );
      }
      query.pet_id = new Types.ObjectId(params.petId);
    }

    if (params.periodKey !== null) {
      query.period_key = params.periodKey;
    }

    if (
      params.excludeBookingId &&
      Types.ObjectId.isValid(params.excludeBookingId)
    ) {
      query.booking_id = { $ne: new Types.ObjectId(params.excludeBookingId) };
    }

    return this.promotionUsageModel.countDocuments(query).exec();
  }

  async assertCanUse(params: {
    promotionId: string;
    maxUsage: number;
    limitType: PromotionLimitType;
    usagePeriod: PromotionUsagePeriod;
    bookingDate: Date;
    userId?: string;
    petId?: string;
    excludeBookingId?: string;
  }): Promise<void> {
    if (params.limitType === PromotionLimitType.NONE) return;

    const periodKey = PromotionUsageService.computePeriodKey(
      params.bookingDate,
      params.usagePeriod,
    );

    const usedCount = await this.getUsedCount({
      promotionId: params.promotionId,
      limitType: params.limitType,
      userId: params.userId,
      petId: params.petId,
      periodKey,
      excludeBookingId: params.excludeBookingId,
    });

    if (usedCount >= params.maxUsage) {
      throw new BadRequestException('Promotion usage limit reached');
    }
  }

  async countUsage(params: {
    promotionId: string;
    limitType: PromotionLimitType;
    usagePeriod: PromotionUsagePeriod;
    bookingDate: Date;
    userId?: string;
    petId?: string;
  }): Promise<number> {
    if (params.limitType === PromotionLimitType.NONE) return 0;

    const periodKey = PromotionUsageService.computePeriodKey(
      params.bookingDate,
      params.usagePeriod,
    );

    return this.getUsedCount({
      promotionId: params.promotionId,
      limitType: params.limitType,
      userId: params.userId,
      petId: params.petId,
      periodKey,
    });
  }

  async recordUsage(params: {
    promotionId: string;
    bookingId: string;
    bookingDate: Date;
    limitType: PromotionLimitType;
    usagePeriod: PromotionUsagePeriod;
    userId?: string;
    petId?: string;
  }): Promise<PromotionUsage> {
    // Validate required ObjectIds
    if (!Types.ObjectId.isValid(params.promotionId)) {
      throw new BadRequestException(
        `Invalid promotionId: ${params.promotionId}`,
      );
    }
    if (!Types.ObjectId.isValid(params.bookingId)) {
      throw new BadRequestException(`Invalid bookingId: ${params.bookingId}`);
    }

    // Validate limit-specific requirements
    if (params.limitType === PromotionLimitType.PER_USER) {
      if (!params.userId || !Types.ObjectId.isValid(params.userId)) {
        throw new BadRequestException(
          `userId is required and must be valid for per-user limit (received: ${params.userId})`,
        );
      }
    }

    if (params.limitType === PromotionLimitType.PER_PET) {
      if (!params.petId || !Types.ObjectId.isValid(params.petId)) {
        throw new BadRequestException(
          `petId is required and must be valid for per-pet limit (received: ${params.petId})`,
        );
      }
    }

    const periodKey = PromotionUsageService.computePeriodKey(
      params.bookingDate,
      params.usagePeriod,
    );

    const payload: Partial<PromotionUsage> = {
      promotion_id: new Types.ObjectId(params.promotionId),
      booking_id: new Types.ObjectId(params.bookingId),
      user_id:
        params.limitType === PromotionLimitType.PER_USER && params.userId
          ? new Types.ObjectId(params.userId)
          : null,
      pet_id:
        params.limitType === PromotionLimitType.PER_PET && params.petId
          ? new Types.ObjectId(params.petId)
          : null,
      limit_type: params.limitType,
      usage_period: params.usagePeriod,
      booking_date: params.bookingDate,
      period_key: periodKey,
      used_at: new Date(),
      isDeleted: false,
      deletedAt: null,
    };

    return new this.promotionUsageModel(payload).save();
  }

  async softDeleteByBookingId(bookingId: string): Promise<void> {
    if (!Types.ObjectId.isValid(bookingId)) return;

    await this.promotionUsageModel.updateMany(
      { booking_id: new Types.ObjectId(bookingId), isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
  }
}
