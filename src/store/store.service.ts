import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Store, StoreDocument } from './entities/store.entity';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
  ) {}

  async create(body: CreateStoreDto) {
    try {
      const store = new this.storeModel(body);

      return await store.save();
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }

      throw error;
    }
  }

  async findAll() {
    const stores = await this.storeModel.find({ isDeleted: false }).lean();

    // Get today's date normalized to UTC midnight
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get store IDs
    const storeIds = stores.map((store) => store._id);

    // Find today's capacities for all stores
    const todayCapacities = await this.storeDailyCapacityModel
      .find({
        store_id: { $in: storeIds },
        date: today,
      })
      .lean();

    // Create a map for quick lookup
    const capacityMap = Object.fromEntries(
      todayCapacities.map((c) => [
        c.store_id.toString(),
        c.total_capacity_minutes,
      ]),
    );

    // Override capacity if found
    const storesWithCapacity = stores.map((store) => ({
      ...store,
      capacity: {
        ...store.capacity,
        default_daily_capacity_minutes:
          capacityMap[store._id.toString()] ??
          store.capacity?.default_daily_capacity_minutes,
      },
    }));
    return storesWithCapacity;
  }

  async findOne(id: ObjectId) {
    const store = await this.storeModel.findById(id).lean();

    if (!store) {
      return null;
    }

    // Get today's date normalized to UTC midnight
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find today's capacity for this store
    const todayCapacity = await this.storeDailyCapacityModel
      .findOne({
        store_id: id,
        date: today,
      })
      .lean();

    // Convert to object and override capacity if found
    if (todayCapacity && store.capacity) {
      store.capacity.default_daily_capacity_minutes = (
        todayCapacity as any
      ).total_capacity_minutes;
    }

    return store;
  }

  async update(id: ObjectId, body: UpdateStoreDto) {
    try {
      const store = await this.storeModel.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true },
      );

      return store;
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }

      throw error;
    }
  }

  async remove(id: ObjectId) {
    const store = await this.storeModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return store;
  }
}
