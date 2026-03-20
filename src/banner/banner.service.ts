import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Banner, BannerDocument } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { GetBannersQueryDto } from './dto/get-banners-query.dto';

@Injectable()
export class BannerService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
  ) {}

  async create(body: CreateBannerDto) {
    const banner = new this.bannerModel(body);
    return await banner.save();
  }

  async findAll(query: GetBannersQueryDto) {
    const { page = 1, limit = 10, is_active } = query;

    const filter: any = { isDeleted: false };
    if (is_active !== undefined) filter.is_active = is_active;

    const skip = (page - 1) * limit;
    const total = await this.bannerModel.countDocuments(filter).exec();

    const banners = await this.bannerModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ order: 1, createdAt: -1 })
      .exec();

    return {
      banners,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    return await this.bannerModel.findById(id).exec();
  }

  async update(id: ObjectId, body: UpdateBannerDto) {
    const banner = await this.bannerModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    );

    if (!banner) throw new NotFoundException('data not found');
    return banner;
  }

  async remove(id: ObjectId) {
    const banner = await this.bannerModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    if (!banner) throw new NotFoundException('data not found');
    return banner;
  }

  async getPublicBanners() {
    const banners = await this.bannerModel
      .find({ isDeleted: false, is_active: true })
      .select(
        '_id banner_desktop banner_mobile add_text title subtitle text_align text_color cta order',
      )
      .sort({ order: 1, createdAt: -1 })
      .exec();

    return banners;
  }
}
