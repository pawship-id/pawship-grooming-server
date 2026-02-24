import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Pet, PetDocument } from './entities/pet.entity';
import { Model, Types } from 'mongoose';
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

    // Convert string IDs to ObjectId
    const petData: any = {
      ...body,
      pet_type_id: new Types.ObjectId(body.pet_type_id),
      size_category_id: new Types.ObjectId(body.size_category_id),
      breed_category_id: new Types.ObjectId(body.breed_category_id),
      customer_id: new Types.ObjectId(body.customer_id),
    };

    if (body.feather_category_id) {
      petData.feather_category_id = new Types.ObjectId(
        body.feather_category_id,
      );
    }

    if (body.member_category_id) {
      petData.member_category_id = new Types.ObjectId(body.member_category_id);
    }

    if (body.memberships && body.memberships.length > 0) {
      petData.memberships = body.memberships.map((membership) => ({
        ...membership,
        membership_id: new Types.ObjectId(membership.membership_id),
      }));
    }

    if (body.tags) {
      petData.tags = body.tags.map((tag) => capitalizeWords(tag));
    }

    const pet = new this.petModel(petData);

    return await pet.save();
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

    // Convert string IDs to ObjectId
    const updateData: Record<string, unknown> = { ...body };

    const idFields: (keyof typeof body)[] = [
      'pet_type_id',
      'size_category_id',
      'breed_category_id',
      'customer_id',
      'feather_category_id',
      'member_category_id',
    ];

    idFields.forEach((field) => {
      const value = body[field];
      if (value) {
        (updateData as any)[field] = new Types.ObjectId(value as any);
      }
    });

    if (body.memberships && body.memberships.length > 0) {
      updateData.memberships = body.memberships.map((membership) => ({
        ...membership,
        membership_id: new Types.ObjectId(membership.membership_id),
      }));
    }

    if (body.tags) {
      updateData.tags = body.tags.map((tag) => capitalizeWords(tag));
    }

    const pet = await this.petModel.findByIdAndUpdate(
      id,
      { $set: updateData },
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
