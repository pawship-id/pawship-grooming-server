import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import {
  ServiceType,
  ServiceTypeDocument,
} from './entities/service-type.entity';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { GetServiceTypesQueryDto } from './dto/get-service-types-query.dto';

@Injectable()
export class ServiceTypeService {
  constructor(
    @InjectModel(ServiceType.name)
    private readonly serviceTypeModel: Model<ServiceTypeDocument>,
  ) {}

  async create(body: CreateServiceTypeDto) {
    const data: Partial<ServiceType> = {
      ...body,
      store_ids: body.store_ids?.map((id) => new ObjectId(id)),
    };

    const serviceType = new this.serviceTypeModel(data);
    return await serviceType.save();
  }

  async findAll(query: GetServiceTypesQueryDto) {
    const { page = 1, limit = 10, search, is_active, show_in_homepage } = query;

    const filter: any = { isDeleted: false };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } },
      ];
    }

    if (is_active !== undefined) filter.is_active = is_active;
    if (show_in_homepage !== undefined)
      filter.show_in_homepage = show_in_homepage;

    const skip = (page - 1) * limit;
    const total = await this.serviceTypeModel.countDocuments(filter).exec();

    const serviceTypes = await this.serviceTypeModel
      .find(filter)
      .populate('stores', 'code name description')
      .skip(skip)
      .limit(limit)
      .sort({ order: 1, createdAt: -1 })
      .exec();

    return {
      serviceTypes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllForHomepage() {
    return await this.serviceTypeModel
      .find({ isDeleted: false, is_active: true, show_in_homepage: true })
      .select('title description image_url order')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: ObjectId) {
    return await this.serviceTypeModel
      .findById(id)
      .populate('stores', 'code name description')
      .exec();
  }

  async update(id: ObjectId, body: UpdateServiceTypeDto) {
    const data: Partial<ServiceType> = {
      ...body,
      store_ids: body.store_ids?.map((id) => new ObjectId(id)),
    };

    const serviceType = await this.serviceTypeModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true },
    );

    if (!serviceType) throw new NotFoundException('data not found');

    return serviceType;
  }

  async remove(id: ObjectId) {
    return await this.serviceTypeModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }
}
