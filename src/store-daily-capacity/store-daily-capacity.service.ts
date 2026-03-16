import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from './entities/store-daily-capacity.entity';
import { CreateStoreDailyCapacityDto } from './dto/create-store-daily-capacity.dto';
import { UpdateStoreDailyCapacityDto } from './dto/update-store-daily-capacity.dto';
import { ObjectId } from 'mongodb';

@Injectable()
export class StoreDailyCapacityService {
  constructor(
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
  ) {}

  async create(body: CreateStoreDailyCapacityDto) {
    // Convert string IDs to ObjectId
    const capacityData: any = {
      ...body,
      store_id: new Types.ObjectId(body.store_id),
    };

    if (body.created_by) {
      capacityData.created_by = new Types.ObjectId(body.created_by);
    }

    const capacity = new this.storeDailyCapacityModel(capacityData);
    return await capacity.save();
  }

  async findAll() {
    const capacities = await this.storeDailyCapacityModel
      .find()
      .populate('store', 'name code')
      .populate('creator', 'username email')
      .exec();

    return capacities;
  }

  async findOne(id: ObjectId) {
    const capacity = await this.storeDailyCapacityModel
      .findById(id)
      .populate('store', 'name code')
      .populate('creator', 'username email')
      .exec();

    if (!capacity) {
      throw new NotFoundException('Store daily capacity not found');
    }

    return capacity;
  }

  async update(id: ObjectId, body: UpdateStoreDailyCapacityDto) {
    // Convert string IDs to ObjectId
    const updateData: any = { ...body };

    if (body.store_id) {
      updateData.store_id = new Types.ObjectId(body.store_id);
    }

    if (body.created_by) {
      updateData.created_by = new Types.ObjectId(body.created_by);
    }

    const capacity = await this.storeDailyCapacityModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    if (!capacity) {
      throw new NotFoundException('Store daily capacity not found');
    }

    return capacity;
  }

  async remove(id: ObjectId) {
    const capacity = await this.storeDailyCapacityModel.findByIdAndDelete(id);

    if (!capacity) {
      throw new NotFoundException('Store daily capacity not found');
    }

    return capacity;
  }
}
