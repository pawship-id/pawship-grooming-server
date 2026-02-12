import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  BadRequestException,
  NotFoundException,
  Put,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { ObjectId } from 'mongodb';

@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post()
  async create(@Body() body: CreateMembershipDto) {
    await this.membershipService.create(body);

    return {
      message: 'Create membership successfully',
    };
  }

  @Get()
  async findAll() {
    const memberships = await this.membershipService.findAll();

    return {
      message: 'Fetch memberships successfully',
      memberships,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const membership = await this.membershipService.findOne(_id);
    if (!membership || membership.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch membership successfully',
      membership,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateMembershipDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const membership = await this.membershipService.findOne(_id);
    if (!membership || membership.isDeleted)
      throw new NotFoundException('data not found');

    await this.membershipService.update(_id, body);

    return {
      message: 'Update membership successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const membership = await this.membershipService.findOne(_id);
    if (!membership || membership.isDeleted)
      throw new NotFoundException('data not found');

    await this.membershipService.remove(_id);

    return {
      message: 'Delete membership successfully',
    };
  }
}
