import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from './entities/store-daily-capacity.entity';
import { CreateStoreDailyCapacityDto } from './dto/create-store-daily-capacity.dto';
import { UpdateStoreDailyCapacityDto } from './dto/update-store-daily-capacity.dto';
import { GetStoreDailyCapacitiesDto } from './dto/get-store-daily-capacities.dto';
import { ObjectId } from 'mongodb';

@Injectable()
export class StoreDailyCapacityService {
  constructor(
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
  ) {}

  async create(body: CreateStoreDailyCapacityDto) {
    // Convert string IDs to ObjectId
    const storeId = new Types.ObjectId(body.store_id);
    const targetDate = new Date(body.date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const capacityData: any = {
      store_id: storeId,
      date: targetDate,
      total_capacity_minutes: body.total_capacity_minutes,
      notes: body.notes,
    };

    if (body.created_by) {
      capacityData.created_by = new Types.ObjectId(body.created_by);
    }

    // Use findOneAndUpdate with upsert to avoid duplicates
    // This will update if exists, or create if not
    const capacity = await this.storeDailyCapacityModel.findOneAndUpdate(
      {
        store_id: storeId,
        date: { $gte: targetDate, $lt: nextDay },
      },
      { $set: capacityData },
      { new: true, upsert: true },
    );

    return capacity;
  }

  async findAll(query?: GetStoreDailyCapacitiesDto) {
    const filter: any = {};

    // Filter by store_id if provided
    if (query?.store_id) {
      filter.store_id = new Types.ObjectId(query.store_id);
    }

    // Filter by date if provided
    if (query?.date) {
      const targetDate = new Date(query.date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: targetDate, $lt: nextDay };
    }

    const capacities = await this.storeDailyCapacityModel
      .find(filter)
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
