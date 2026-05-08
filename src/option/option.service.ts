import { Injectable } from '@nestjs/common';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Option, OptionDocument } from './entities/option.entity';
import { Model, Types } from 'mongoose';
import { ObjectId } from 'mongodb';
import { capitalizeWords, toLowerCase } from '../helpers/string.helper';

interface OptionFilter {
  isDeleted: boolean;
  category_options?: string;
}

@Injectable()
export class OptionService {
  constructor(
    @InjectModel(Option.name)
    private readonly optionModel: Model<OptionDocument>,
  ) {}

  async create(body: CreateOptionDto) {
    body.name = capitalizeWords(body.name);

    // Convert pet_weight_rules petTypeId from string to ObjectId
    const optionData: any = { ...body };
    if (body.pet_weight_rules && body.pet_weight_rules.length > 0) {
      optionData.pet_weight_rules = body.pet_weight_rules.map((rule) => ({
        minWeight: rule.minWeight,
        maxWeight: rule.maxWeight,
        petTypeId: new Types.ObjectId(rule.petTypeId),
      }));
    }

    const option = new this.optionModel(optionData);

    return await option.save();
  }

  async findAll(category: string | undefined) {
    const filter: OptionFilter = {
      isDeleted: false,
    };

    if (category) {
      filter.category_options = toLowerCase(category);
    }

    const options = await this.optionModel
      .find(filter)
      .populate('pet_weight_rules.petTypeId', 'name')
      .exec();
    return options;
  }

  async findOne(id: ObjectId) {
    const option = await this.optionModel
      .findById(id)
      .populate('pet_weight_rules.petTypeId', 'name')
      .exec();
    return option;
  }

  async update(id: ObjectId, body: UpdateOptionDto) {
    if (body.name) {
      body.name = capitalizeWords(body.name);
    }

    // Convert pet_weight_rules petTypeId from string to ObjectId
    const updateData: any = { ...body };
    if (body.pet_weight_rules && body.pet_weight_rules.length > 0) {
      updateData.pet_weight_rules = body.pet_weight_rules.map((rule) => ({
        minWeight: rule.minWeight,
        maxWeight: rule.maxWeight,
        petTypeId: new Types.ObjectId(rule.petTypeId),
      }));
    }

    const option = await this.optionModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('pet_weight_rules.petTypeId', 'name');

    return option;
  }

  async remove(id: ObjectId) {
    const option = await this.optionModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return option;
  }
}
