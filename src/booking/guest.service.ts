import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/user/user.model';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { CreateGuestPetDto } from './dto/create-guest-pet.dto';
import { hashPassword } from 'src/helpers/bcrypt';
import { ObjectId } from 'mongodb';
import { UserRole } from 'src/user/user.dto';

@Injectable()
export class GuestService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Pet.name) private readonly petModel: Model<PetDocument>,
  ) {}

  async checkUserByPhone(phone_number: string) {
    const user = await this.userModel
      .findOne({
        phone_number,
        isDeleted: false,
      })
      .select('_id username email phone_number role')
      .exec();

    if (!user) {
      return {
        exists: false,
        user: null,
        pets: [],
      };
    }

    const pets = await this.petModel
      .find({
        customer_id: user._id,
        isDeleted: false,
      })
      .select(
        '_id name size_category_id breed_category_id pet_type_id hair_category_id',
      )
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('hair', 'name')
      .populate('pet_type', 'name')
      .exec();

    return {
      exists: true,
      user,
      pets,
    };
  }

  async registerGuestUser(dto: RegisterGuestDto) {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: dto.email }, { phone_number: dto.phone_number }],
      isDeleted: false,
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new BadRequestException('Email already registered');
      }
      if (existingUser.phone_number === dto.phone_number) {
        throw new BadRequestException('Phone number already registered');
      }
    }

    const defaultPassword = 'pawship123';
    const hashedPassword = await hashPassword(defaultPassword);

    const newUser = new this.userModel({
      username: dto.username,
      email: dto.email,
      phone_number: dto.phone_number,
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      is_active: true,
    });

    const savedUser = await newUser.save();

    const newPet = new this.petModel({
      name: dto.pet.name,
      pet_type_id: new ObjectId(dto.pet.pet_type_id),
      breed_category_id: new ObjectId(dto.pet.breed_category_id),
      size_category_id: new ObjectId(dto.pet.size_category_id),
      customer_id: savedUser._id,
      is_active: true,
    });

    const savedPet = await newPet.save();

    // TODO: Send welcome email with credentials
    // await this.emailService.sendWelcomeEmail({
    //   email: dto.email,
    //   username: dto.username,
    //   password: defaultPassword,
    // });

    return {
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        phone_number: savedUser.phone_number,
        role: savedUser.role,
      },
      pet: {
        _id: savedPet._id,
        name: savedPet.name,
      },
      credentials: {
        email: dto.email,
        password: defaultPassword,
      },
    };
  }

  async createPetForGuest(dto: CreateGuestPetDto) {
    const user = await this.userModel
      .findOne({
        phone_number: dto.phone_number,
        isDeleted: false,
      })
      .select('_id username email phone_number')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found with this phone number');
    }

    const newPet = new this.petModel({
      name: dto.pet_name,
      pet_type_id: new ObjectId(dto.pet_type_id),
      breed_category_id: new ObjectId(dto.breed_category_id),
      size_category_id: new ObjectId(dto.size_category_id),
      customer_id: user._id,
      is_active: true,
    });

    const savedPet = await newPet.save();

    const populatedPet = await this.petModel
      .findById(savedPet._id)
      .select('_id name size_category_id breed_category_id pet_type_id')
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('pet_type', 'name')
      .exec();

    return {
      pet: populatedPet,
      customer: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
      },
    };
  }
}
