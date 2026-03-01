import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Zone, ZoneDocument } from './entities/zone.entity';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { GetZonesQueryDto } from './dto/get-zones-query.dto';

@Injectable()
export class ZoneService {
  constructor(
    @InjectModel(Zone.name)
    private readonly zoneModel: Model<ZoneDocument>,
  ) {}

  async create(body: CreateZoneDto) {
    try {
      const zone = new this.zoneModel(body);
      return await zone.save();
    } catch (error) {
      throw error;
    }
  }

  async findAll(query: GetZonesQueryDto) {
    const { page = 1, limit = 10, search, store_id } = query;

    const filter: any = { isDeleted: false };

    if (search) {
      filter.$or = [{ area_name: { $regex: search, $options: 'i' } }];
    }

    if (store_id) {
      filter.store_id = new ObjectId(store_id);
    }

    const skip = (page - 1) * limit;
    const total = await this.zoneModel.countDocuments(filter).exec();

    const zones = await this.zoneModel
      .find(filter)
      .populate('store')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      zones,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    return await this.zoneModel.findById(id).populate('store').exec();
  }

  async update(id: ObjectId, body: UpdateZoneDto) {
    return await this.zoneModel
      .findByIdAndUpdate(id, { $set: body }, { new: true })
      .populate('store')
      .exec();
  }

  async remove(id: ObjectId) {
    return await this.zoneModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }
}
