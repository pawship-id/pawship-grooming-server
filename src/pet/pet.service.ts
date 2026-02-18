import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Pet, PetDocument } from './entities/pet.entity';
import { Model } from 'mongoose';
import { capitalizeWords } from 'src/helpers/string.helper';
import { ObjectId } from 'mongodb';

@Injectable()
export class PetService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,
  ) {}

  async create(body: CreatePetDto) {
    body.name = capitalizeWords(body.name);
    const user = new this.petModel(body);

    return await user.save();
  }

  async findAll() {
    const pets = await this.petModel
      .find({ isDeleted: false })
      .populate('pet_type', 'name')
      .populate('feather', 'name')
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('member_category', 'name')
      .populate('owner', 'username')
      .exec();

    return pets;
  }

  async findOne(id: ObjectId) {
    const pet = await this.petModel
      .findById(id)
      .populate('pet_type', 'name')
      .populate('feather', 'name')
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('member_category', 'name')
      .populate('owner', 'username')
      .exec();

    return pet;
  }

  async update(id: ObjectId, body: UpdatePetDto) {
    if (body.name) {
      body.name = capitalizeWords(body.name);
    }

    const pet = await this.petModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    );

    return pet;
  }

  async remove(id: ObjectId) {
    const pet = await this.petModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return pet;
  }

  async getPetSnapshot(petId: ObjectId) {
    const pet = await this.petModel
      .findById(petId)
      .select('name isDeleted member_category_id size_category_id')
      .populate('member_category', 'name')
      .exec();

    if (!pet || pet.isDeleted) {
      throw new NotFoundException('pet not found');
    }

    return {
      name: pet.name,
      member_type: (pet as any).member_category?.name ?? null,
      size_category_id: pet.size_category_id,
    };
  }
}
