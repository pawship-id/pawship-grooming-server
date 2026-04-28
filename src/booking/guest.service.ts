import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { CreateGuestPetDto } from './dto/create-guest-pet.dto';
import { hashPassword } from 'src/helpers/bcrypt';
import { capitalizeWords } from 'src/helpers/string.helper';
import { ObjectId } from 'mongodb';
import { UserRole } from 'src/user/dto/user.dto';

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
      .select('_id username email phone_number role is_idle profile.addresses')
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

    const userObj = user.toObject();

    return {
      exists: true,
      user: {
        ...userObj,
        // Normalize: null/undefined → true (backward compat for accounts created before is_idle existed)
        is_idle: userObj.is_idle !== false,
        addresses: userObj.profile?.addresses ?? [],
      },
      pets,
    };
  }

  // method to register user + pet
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
      username: capitalizeWords(dto.username),
      email: dto.email,
      phone_number: dto.phone_number,
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      is_active: true,
      is_idle: true,
    });

    const savedUser = await newUser.save();

    const newPet = new this.petModel({
      name: dto.pet.name,
      pet_type_id: new ObjectId(dto.pet.pet_type_id),
      breed_category_id: new ObjectId(dto.pet.breed_category_id),
      size_category_id: new ObjectId(dto.pet.size_category_id),
      hair_category_id: new ObjectId(dto.pet.hair_category_id),
      customer_id: savedUser._id,
      is_active: true,
    });

    const savedPet = await newPet.save();

    const populatedPet = await this.petModel
      .findById(savedPet._id)
      .select(
        '_id name size_category_id breed_category_id pet_type_id hair_category_id',
      )
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('pet_type', 'name')
      .populate('hair', 'name')
      .exec();

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
      pet: populatedPet,
      credentials: {
        email: dto.email,
        password: defaultPassword,
      },
    };
  }

  // method to register pet only when user found
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
      hair_category_id: new ObjectId(dto.hair_category_id),
      customer_id: user._id,
      is_active: true,
    });

    const savedPet = await newPet.save();

    const populatedPet = await this.petModel
      .findById(savedPet._id)
      .select(
        '_id name size_category_id breed_category_id pet_type_id hair_category_id',
      )
      .populate('size', 'name')
      .populate('breed', 'name')
      .populate('pet_type', 'name')
      .populate('hair', 'name')
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

  /**
   * Update or add address for an idle user (never logged in).
   * Only allowed when is_idle !== false to prevent editing active user data without auth.
   * - If address_id is provided: update that specific address
   * - If address_id is omitted: add a new address
   * - If is_main_address is true: unset is_main_address on all other addresses first
   */
  async updateAddressForIdleUser(
    phone_number: string,
    address: {
      label?: string;
      street?: string;
      subdistrict?: string;
      district?: string;
      city?: string;
      province?: string;
      postal_code?: string;
      note?: string;
      latitude?: number;
      longitude?: number;
      is_main_address?: boolean;
    },
    address_id?: string,
  ) {
    const user = await this.userModel
      .findOne({ phone_number, isDeleted: false })
      .select('_id is_idle profile')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found with this phone number');
    }

    // Security: only allow address updates for idle users
    if (user.is_idle === false) {
      throw new BadRequestException(
        'Cannot update address for active user. Please login first.',
      );
    }

    const addresses: any[] = ((user.profile?.addresses ?? []) as any[]).map(
      (a) => ({ ...a }),
    );

    if (address_id) {
      // Update existing address by _id
      const idx = addresses.findIndex(
        (a: any) => a._id?.toString() === address_id,
      );
      if (idx === -1) {
        throw new NotFoundException('Address not found');
      }
      // If setting as main, unset all others
      if (address.is_main_address) {
        addresses.forEach((a: any) => (a.is_main_address = false));
      }
      addresses[idx] = {
        ...addresses[idx],
        ...address,
        created_by: addresses[idx].created_by ?? 'customer',
      };
    } else {
      // Add new address
      // If setting as main (or first address), unset all others
      const willBeMain =
        address.is_main_address !== undefined
          ? address.is_main_address
          : addresses.length === 0;
      if (willBeMain) {
        addresses.forEach((a: any) => (a.is_main_address = false));
      }
      addresses.push({
        ...address,
        is_main_address: willBeMain,
        created_by: 'customer',
      });
    }

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { 'profile.addresses': addresses } },
    );

    return { message: 'Address updated successfully' };
  }
}
