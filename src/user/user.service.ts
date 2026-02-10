import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { hashPassword } from 'src/helpers/bcrypt';
import { User, UserDocument } from './user.model';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getUsers() {
    const users = await this.userModel.find({ isDeleted: false }).exec();
    return users;
  }

  async findById(id: ObjectId) {
    const user = await this.userModel.findById(id).exec();
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
      const user = await this.userModel.findByIdAndUpdate(
        id,
        { $set: body },
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

  async delete(id: ObjectId) {
    const user = await this.userModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return user;
  }
}
