import { Injectable } from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Membership, MembershipDocument } from './entities/membership.entity';
import { Model } from 'mongoose';
import { capitalizeWords } from 'src/helpers/string.helper';
import { ObjectId } from 'mongodb';

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
  ) {}

  async create(body: CreateMembershipDto) {
    body.name = capitalizeWords(body.name);
    const user = new this.membershipModel(body);

    return await user.save();
  }

  async findAll() {
    const memberships = await this.membershipModel
      .find({ isDeleted: false })
      .populate('pet_types', 'name')
      .populate('service_includes', 'name')
      .exec();

    return memberships;
  }

  async findOne(id: ObjectId) {
    const membership = await this.membershipModel
      .findById(id)
      .populate('pet_types', 'name')
      .populate('service_includes', 'name')
      .exec();

    return membership;
  }

  async update(id: ObjectId, body: UpdateMembershipDto) {
    if (body.name) {
      body.name = capitalizeWords(body.name);
    }
    const membership = await this.membershipModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    );

    return membership;
  }

  async remove(id: ObjectId) {
    const membership = await this.membershipModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return membership;
  }
}
