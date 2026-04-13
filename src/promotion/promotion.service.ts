import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Promotion, PromotionDocument } from './entities/promotion.entity';
import { AppliesTo, CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { GetPromotionsQueryDto } from './dto/get-promotions-query.dto';
import { capitalizeWords } from 'src/helpers/string.helper';

@Injectable()
export class PromotionService {
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
  ) {}

  /** Force service_id to null when applies_to is pickup or booking */
  private normalizeServiceId(
    body: Partial<Pick<CreatePromotionDto, 'applies_to' | 'service_id'>>,
  ) {
    if (
      body.applies_to === AppliesTo.PICKUP ||
      body.applies_to === AppliesTo.BOOKING
    ) {
      body.service_id = null;
    }
  }

  async create(body: CreatePromotionDto) {
    body.name = capitalizeWords(body.name);
    this.normalizeServiceId(body);
    try {
      return await new this.promotionModel(body).save();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === 11000) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const duplicatedField = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
      throw error;
    }
  }

  async findAll(query: GetPromotionsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      is_active,
      applies_to,
      discount_type,
      is_available_to_membership,
      is_stackable,
    } = query;

    const filter: Record<string, any> = { isDeleted: false };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    if (is_active !== undefined) filter.is_active = is_active;
    if (applies_to) filter.applies_to = applies_to;
    if (discount_type) filter.discount_type = discount_type;
    if (is_available_to_membership !== undefined)
      filter.is_available_to_membership = is_available_to_membership;
    if (is_stackable !== undefined) filter.is_stackable = is_stackable;

    const skip = (page - 1) * limit;
    const total = await this.promotionModel.countDocuments(filter).exec();
    const promotions = await this.promotionModel
      .find(filter)
      .populate('service_id', 'name code')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      promotions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    return await this.promotionModel
      .findOne({ _id: id, isDeleted: false })
      .populate('service_id', 'name code')
      .exec();
  }

  async findById(id: ObjectId) {
    return await this.promotionModel.findById(id).exec();
  }

  async update(id: ObjectId, body: UpdatePromotionDto) {
    if (body.name) body.name = capitalizeWords(body.name);
    this.normalizeServiceId(body);
    try {
      return await this.promotionModel
        .findByIdAndUpdate(id, body, { new: true })
        .exec();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === 11000) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const duplicatedField = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
      throw error;
    }
  }

  async remove(id: ObjectId) {
    return await this.promotionModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }
}
