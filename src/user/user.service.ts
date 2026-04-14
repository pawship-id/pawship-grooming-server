import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model, Types } from 'mongoose';
import { hashPassword } from 'src/helpers/bcrypt';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

    // Batch-fetch pet counts for customer users in this page
    const customerUsers = users.filter((u) => u.role === 'customer');
    let petCountMap: Record<string, number> = {};

    if (customerUsers.length > 0) {
      const petCounts = await this.petModel.aggregate([
        {
          $match: {
            customer_id: { $in: customerUsers.map((u) => u._id) },
            isDeleted: false,
          },
        },
        { $group: { _id: '$customer_id', count: { $sum: 1 } } },
      ]);
      petCountMap = petCounts.reduce(
        (acc, { _id, count }) => {
          acc[_id.toString()] = count;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    const usersWithPetCount = users.map((user) => ({
      ...user.toObject(),
      pet_count:
        user.role === 'customer'
          ? (petCountMap[user._id.toString()] ?? 0)
          : undefined,
    }));

    return {
      users: usersWithPetCount,
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

  async updateProfile(
    userId: ObjectId,
    body: UpdateProfileDto,
    callerRole: string = 'customer',
  ) {
    const setData: Record<string, unknown> = {};

    const scalarFields = [
      'full_name',
      'image_url',
      'public_id',
      'gender',
      'groomer_skills',
      'groomer_rating',
      'tags',
    ] as const;

    const objectIdFields = ['placement', 'customer_category_id'] as const;

    for (const field of scalarFields) {
      if (body[field]) {
        setData[`profile.${field}`] = body[field];
      }
    }

    for (const field of objectIdFields) {
      if (body[field]) {
        setData[`profile.${field}`] = new Types.ObjectId(body[field] as string);
      }
    }

    if (body.addresses) {
      const user = await this.userModel
        .findById(userId)
        .select('profile.addresses');
      const existingAddresses: any[] = (
        user?.profile?.addresses || []
      ).map((a: any) => (a.toObject ? a.toObject() : a));

      // Determine caller created_by value: admin/ops roles → 'admin', customer → 'customer'
      const callerCreatedBy =
        callerRole === 'customer' ? 'customer' : 'admin';

      // Build a map of existing addresses by _id for quick lookup
      const existingMap = new Map<string, any>();
      for (const addr of existingAddresses) {
        if (addr._id) {
          existingMap.set(addr._id.toString(), addr);
        }
      }

      // Build incoming address IDs set
      const incomingIds = new Set<string>();
      for (const addr of body.addresses) {
        if (addr._id) {
          incomingIds.add(addr._id);
        }
      }

      // Find addresses being removed (exist in DB but not in incoming)
      const removedAddresses = existingAddresses.filter(
        (a) => a._id && !incomingIds.has(a._id.toString()),
      );

      // Protect addresses created by the other role from deletion
      const protectedAddresses: any[] = [];
      for (const removed of removedAddresses) {
        const owner = removed.created_by;
        // If created_by is undefined (legacy data), allow deletion by anyone
        if (owner && owner !== callerCreatedBy) {
          protectedAddresses.push(removed);
        }
      }

      // Merge: incoming addresses + protected addresses that caller tried to remove
      let addressesToSave = body.addresses.map((addr) => {
        if (addr._id) {
          // Update existing: preserve created_by from DB
          const existing = existingMap.get(addr._id);
          return {
            ...addr,
            _id: new Types.ObjectId(addr._id),
            created_by: existing?.created_by || callerCreatedBy,
          };
        } else {
          // New address: set created_by to caller's role
          return { ...addr, created_by: callerCreatedBy };
        }
      });

      // Re-add protected addresses that caller is not allowed to delete
      for (const protAddr of protectedAddresses) {
        addressesToSave.push({
          ...protAddr,
          _id: protAddr._id,
        });
      }

      // Handle is_main_address: default first address as main if none exist
      if (existingAddresses.length === 0 && addressesToSave.length > 0) {
        const hasMain = addressesToSave.some((a) => a.is_main_address);
        if (!hasMain) {
          addressesToSave[0].is_main_address = true;
        }
      }

      // Ensure only one is_main_address = true
      if (addressesToSave.filter((a) => a.is_main_address).length > 1) {
        let foundMain = false;
        addressesToSave = addressesToSave.map((a) => {
          if (a.is_main_address && !foundMain) {
            foundMain = true;
            return a;
          }
          return { ...a, is_main_address: false };
        });
      }

      setData['profile.addresses'] = addressesToSave;
    }

    return this.userModel
      .findByIdAndUpdate(userId, { $set: setData }, { new: true })
      .select('-password -refresh_token -refresh_token_expires_at');
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
