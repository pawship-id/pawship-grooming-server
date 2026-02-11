import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Store, StoreDocument } from './entities/store.entity';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
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
    }
  }

  async findAll() {
    const stores = await this.storeModel.find({ isDeleted: false }).exec();
    return stores;
  }

  async findOne(id: ObjectId) {
    const store = await this.storeModel.findById(id).exec();
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
