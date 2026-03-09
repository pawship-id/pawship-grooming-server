import { Injectable } from '@nestjs/common';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Option, OptionDocument } from './entities/option.entity';
import { Model } from 'mongoose';
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
    const option = new this.optionModel(body);

    return await option.save();
  }

  async findAll(category: string | undefined) {
    const filter: OptionFilter = {
      isDeleted: false,
    };

    if (category) {
      filter.category_options = toLowerCase(category);
    }

    const options = await this.optionModel.find(filter).exec();
    return options;
  }

  async findOne(id: ObjectId) {
    const option = await this.optionModel.findById(id).exec();
    return option;
  }

  async update(id: ObjectId, body: UpdateOptionDto) {
    if (body.name) {
      body.name = capitalizeWords(body.name);
    }

    const option = await this.optionModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    );

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
