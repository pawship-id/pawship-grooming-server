import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership, MembershipDocument } from './entities/membership.entity';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { GetMembershipQueryDto } from './dto/get-membership-query.dto';
import { Service } from 'src/service/entities/service.entity';

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
  ) {}

  async create(createMembershipDto: CreateMembershipDto): Promise<Membership> {
    const {
      name,
      duration_months,
      price,
      pet_type_ids = [],
      benefits = [],
      ...rest
    } = createMembershipDto;

    // Validate unique name
    const existingMembership = await this.membershipModel.findOne({
      name,
      isDeleted: false,
    });
    if (existingMembership) {
      throw new BadRequestException('membership with this name already exists');
    }

    const membership = new this.membershipModel({
      name,
      duration_months,
      price,
      pet_type_ids: pet_type_ids.map((id) => new Types.ObjectId(id)),
      benefits: benefits.map((b) => ({
        ...b,
        period: b.period || 'unlimited', // default unlimited jika tidak diisi
        service_id: b.service_id ? new Types.ObjectId(b.service_id) : undefined,
        _id: new Types.ObjectId(),
      })),
      ...rest,
    });

    return membership.save();
  }

  /**
   * Populate service details in membership benefits
   */
  private async populateBenefitServices(membership: any): Promise<any> {
    if (
      !membership ||
      !membership.benefits ||
      membership.benefits.length === 0
    ) {
      return membership;
    }

    const serviceIds = membership.benefits
      .map((b: any) => b.service_id)
      .filter((id: any) => id); // Remove nulls

    if (serviceIds.length === 0) return membership;

    const services = await this.serviceModel
      .find({
        _id: { $in: serviceIds },
      })
      .select('code name price_type price prices')
      .populate({
        path: 'prices.pet_type_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.size_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.hair_id',
        model: 'Option',
        select: 'name',
      });

    const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

    const membershipObjRaw = membership.toObject
      ? membership.toObject()
      : membership;

    const { id, __v, pet_type_ids, ...membershipObj } = membershipObjRaw;

    membershipObj.benefits = membershipObj.benefits.map((b: any) => {
      const { id, service_id, ...data } = b;
      return {
        ...data,
        service: b.service_id
          ? serviceMap.get(b.service_id.toString())
          : undefined,
      };
    });

    return membershipObj;
  }

  async findAll(query: GetMembershipQueryDto): Promise<Membership[]> {
    const conditions: any = { isDeleted: false };

    if (query.pet_type_id) {
      conditions.pet_type_ids = new Types.ObjectId(query.pet_type_id);
    }

    if (query.is_active !== undefined) {
      conditions.is_active = query.is_active;
    }

    const memberships = await this.membershipModel
      .find(conditions)
      .populate('pet_types', 'name')
      .exec();

    // Populate service details in benefits for each membership
    return Promise.all(memberships.map((m) => this.populateBenefitServices(m)));
  }

  async findById(id: string): Promise<Membership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid membership ID');
    }

    const membership = await this.membershipModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!membership) {
      throw new NotFoundException('membership not found');
    }

    return this.populateBenefitServices(membership);
  }

  async findByPetTypeId(petTypeId: string): Promise<Membership[]> {
    if (!Types.ObjectId.isValid(petTypeId)) {
      throw new BadRequestException('invalid pet type ID');
    }

    const memberships = await this.membershipModel.find({
      pet_type_ids: new Types.ObjectId(petTypeId),
      is_active: true,
      isDeleted: false,
    });

    // Populate service details in benefits for each membership
    return Promise.all(memberships.map((m) => this.populateBenefitServices(m)));
  }

  async update(
    id: string,
    updateMembershipDto: UpdateMembershipDto,
  ): Promise<Membership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid membership ID');
    }

    const { name, pet_type_ids, benefits, ...rest } = updateMembershipDto;

    // Validate unique name if updating
    if (name) {
      const existing = await this.membershipModel.findOne({
        name,
        _id: { $ne: new Types.ObjectId(id) },
        isDeleted: false,
      });
      if (existing) {
        throw new BadRequestException(
          'membership with this name already exists',
        );
      }
    }

    const updateData: any = { ...rest };
    if (name) updateData.name = name;
    if (pet_type_ids) {
      updateData.pet_type_ids = pet_type_ids.map(
        (pid) => new Types.ObjectId(pid),
      );
    }
    if (benefits) {
      updateData.benefits = benefits.map((b: any) => ({
        ...b,
        period: b.period || 'unlimited', // default unlimited
        service_id: b.service_id ? new Types.ObjectId(b.service_id) : undefined,
        _id: b._id ? new Types.ObjectId(b._id) : new Types.ObjectId(),
      }));
    }

    const membership = await this.membershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      updateData,
      { new: true, runValidators: true },
    );

    if (!membership) {
      throw new NotFoundException('membership not found');
    }

    return membership;
  }

  async delete(id: string): Promise<Membership> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('invalid membership ID');
    }

    const membership = await this.membershipModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );

    if (!membership) {
      throw new NotFoundException('membership not found');
    }

    return membership;
  }
}
