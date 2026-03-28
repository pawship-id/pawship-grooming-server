import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { GetMembershipQueryDto } from './dto/get-membership-query.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('memberships')
@UseGuards(AuthGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post()
  async create(@Body() createMembershipDto: CreateMembershipDto) {
    const membership = await this.membershipService.create(createMembershipDto);
    return {
      message: 'membership created successfully',
      data: membership,
    };
  }

  @Get()
  async findAll(@Query() query: GetMembershipQueryDto) {
    const memberships = await this.membershipService.findAll(query);
    return {
      message: 'memberships retrieved successfully',
      data: memberships,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const membership = await this.membershipService.findById(id);
    return {
      message: 'membership retrieved successfully',
      data: membership,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateMembershipDto: UpdateMembershipDto,
  ) {
    const membership = await this.membershipService.update(
      id,
      updateMembershipDto,
    );
    return {
      message: 'membership updated successfully',
      data: membership,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const membership = await this.membershipService.delete(id);
    return {
      message: 'membership deleted successfully',
      data: membership,
    };
  }
}
