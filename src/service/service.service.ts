import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './entities/service.entity';
import { ObjectId } from 'mongodb';
import { capitalizeWords } from 'src/helpers/string.helper';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  async create(body: CreateServiceDto) {
    try {
      body.name = capitalizeWords(body.name);
      const user = new this.serviceModel(body);

      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
    }
  }

  async findAll() {
    const services = await this.serviceModel
      .find({ isDeleted: false })
      .populate('service_type', 'name')
      .populate('size_category', 'name')
      .populate('pet_types', 'name')
      .populate('avaiable_store', 'name')
      .exec();

    return services;
  }

  async findOne(id: ObjectId) {
    const service = await this.serviceModel
      .findById(id)
      .populate('service_type', 'name')
      .populate('size_category', 'name')
      .populate('pet_types', 'name')
      .populate('avaiable_store', 'name')
      .exec();
    return service;
  }

  async update(id: ObjectId, body: UpdateServiceDto) {
    try {
      if (body.name) {
        body.name = capitalizeWords(body.name);
      }
      const service = await this.serviceModel.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true },
      );

      return service;
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
    }
  }

  async remove(id: ObjectId) {
    const service = await this.serviceModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return service;
  }
}
