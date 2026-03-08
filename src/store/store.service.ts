import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { GetStoresQueryDto } from './dto/get-stores-query.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Store, StoreDocument } from './entities/store.entity';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import { Service, ServiceDocument } from 'src/service/entities/service.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
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

  async findAll(query: GetStoresQueryDto) {
    const { page = 1, limit = 10, search, is_active, city, province } = query;

    // Build filter object
    const filter: any = { isDeleted: false };

    // Add is_active filter if provided
    if (is_active !== undefined) {
      filter.is_active = is_active;
    }

    // Add city filter if provided
    if (city) {
      filter['location.city'] = { $regex: city, $options: 'i' };
    }

    // Add province filter if provided
    if (province) {
      filter['location.province'] = { $regex: province, $options: 'i' };
    }

    // Add search filter if provided (search in name, code, description, address)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await this.storeModel.countDocuments(filter).exec();

    // Fetch stores with filters, pagination, and sorting
    const stores = await this.storeModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate({
        path: 'zones',
        match: {
          isDeleted: false,
          is_active: true,
        },
      })
      .lean();

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

    return {
      stores: storesWithCapacity,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    const store = await this.storeModel
      .findById(id)
      .populate({
        path: 'zones',
        match: {
          isDeleted: false,
          is_active: true,
        },
      })
      .lean();

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

    // Find services available at this store
    const services = await this.serviceModel
      .find({
        $or: [
          { available_store_ids: { $size: 0 } }, // Services available at all stores
          { available_store_ids: id }, // Services specifically for this store
        ],
        isDeleted: false,
        is_active: true,
      })
      .populate('service_type', 'name')
      .populate('size_categories', 'name')
      .populate('pet_types', 'name')
      .populate('prices.size_id', 'name')
      .exec();

    return {
      ...store,
      services,
    };
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

  async findAllWithServiceTypes() {
    const stores = await this.storeModel
      .find({ isDeleted: false, is_active: true })
      .populate({
        path: 'serviceTypes',
        select: 'title description image_url',
        match: {
          isDeleted: false,
          is_active: true,
        },
      })
      .populate({
        path: 'zones',
        match: {
          isDeleted: false,
          is_active: true,
        },
      })
      .sort({ createdAt: -1 })
      .exec();

    return { stores };
  }
}
