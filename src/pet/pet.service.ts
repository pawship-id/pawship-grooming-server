import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { GetPetsQueryDto } from './dto/get-pets-query.dto';
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

    if (body.hair_category_id) {
      petData.hair_category_id = new Types.ObjectId(body.hair_category_id);
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

  async findAll(query: GetPetsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      is_active,
      pet_type_id,
      size_category_id,
      breed_category_id,
      member_category_id,
      customer_id,
    } = query;

    const filter: any = { isDeleted: false };

    if (is_active !== undefined) {
      filter.is_active = is_active;
    }

    if (pet_type_id) {
      filter.pet_type_id = pet_type_id;
    }

    if (size_category_id) {
      filter.size_category_id = size_category_id;
    }

    if (breed_category_id) {
      filter.breed_category_id = breed_category_id;
    }

    if (member_category_id) {
      filter.member_category_id = member_category_id;
    }

    if (customer_id) {
      filter.customer_id = customer_id;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { internal_note: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await this.petModel.countDocuments(filter).exec();

    const pets = await this.petModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('pet_type', 'name')
      .populate('hair', 'name')
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('member_category', 'name')
      .populate('owner', 'username')
      .exec();

    return {
      pets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    const pet = await this.petModel
      .findById(id)
      .populate('pet_type', 'name')
      .populate('hair', 'name')
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
      'hair_category_id',
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
      .select(
        'name isDeleted member_category_id size_category_id pet_type_id hair_category_id breed_category_id',
      )
      .populate('member_category', 'name')
      .populate('pet_type', '_id name')
      .populate('size', '_id name')
      .populate('hair', '_id name')
      .populate('breed', '_id name')
      .exec();

    if (!pet || pet.isDeleted) {
      throw new NotFoundException('pet not found');
    }

    const petType = (pet as any).pet_type;
    const size = (pet as any).size;
    const hair = (pet as any).hair;
    const breed = (pet as any).breed;

    return {
      name: pet.name,
      member_type: (pet as any).member_category?.name ?? null,
      pet_type: { _id: petType._id, name: petType.name },
      size: { _id: size._id, name: size.name },
      hair: { _id: hair._id, name: hair.name },
      breed: { _id: breed._id, name: breed.name },
    };
  }
}
