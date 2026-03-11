import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { hashPassword } from 'src/helpers/bcrypt';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Pet.name) private readonly petModel: Model<PetDocument>,
  ) {}

  async getUsers(query: GetUsersQueryDto) {
    const { page = 1, limit = 10, search, role, is_active } = query;

    // Build filter object
    const filter: any = { isDeleted: false };

    // Add role filter if provided
    if (role) {
      filter.role = role;
    }

    // Add is_active filter if provided
    if (is_active !== undefined) {
      filter.is_active = is_active;
    }

    // Add search filter if provided (search in username, email, phone_number)
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone_number: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await this.userModel.countDocuments(filter).exec();

    // Fetch users with filters, pagination, and sorting
    const users = await this.userModel
      .find(filter)
      .select('-password -refresh_token -refresh_token_expires_at')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: ObjectId) {
    const user = await this.userModel
      .findById(id)
      .select('-password -refresh_token -refresh_token_expires_at')
      .exec();

    // If user is customer, fetch their pets
    if (user && user.role === 'customer') {
      const pets = await this.petModel
        .find({ customer_id: id, isDeleted: false })
        .populate('pet_type', 'name')
        .populate('hair', 'name')
        .populate('size', 'name')
        .populate('breed', 'name')
        .populate('member_category', 'name')
        .exec();

      return { ...user.toObject(), pets };
    }
    return user;
  }

  async create(body: CreateUserDto) {
    try {
      const hash = await hashPassword(body.password);

      const user = new this.userModel({
        username: body.username,
        email: body.email,
        phone_number: body.phone_number,
        password: hash,
        role: body.role,
        is_active: body.is_active,
      });

      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
    }
  }

  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email: email });

    return user;
  }

  async update(id: ObjectId, body: UpdateUserDto) {
    try {
      // Exclude password from update
      const { password, ...updateData } = body;

      const user = await this.userModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      );

      return user;
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
    }
  }

  async toggleStatus(id: ObjectId, is_active: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { is_active },
      { new: true },
    );

    return user;
  }

  async updatePassword(id: ObjectId, password: string) {
    const hash = await hashPassword(password);

    const user = await this.userModel.findByIdAndUpdate(
      id,
      {
        $set: {
          password: hash,
          refresh_token: null,
          refresh_token_expires_at: null,
        },
      },
      { new: true },
    );

    return user;
  }

  async delete(id: ObjectId) {
    const currentUser = await this.userModel.findById(id);
    if (!currentUser) {
      return null;
    }

    const timestamp = Date.now();

    // Add suffix to unique fields to allow reuse of email and phone_number
    const user = await this.userModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        email: `${currentUser.email}_deleted_${timestamp}`,
        phone_number: `${currentUser.phone_number}_deleted_${timestamp}`,
      },
      { new: true },
    );

    return user;
  }
}
