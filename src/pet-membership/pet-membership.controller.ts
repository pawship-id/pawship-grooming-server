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
import { PetMembershipService } from './pet-membership.service';
import { CreatePetMembershipDto } from './dto/create-pet-membership.dto';
import { UpdatePetMembershipDto } from './dto/update-pet-membership.dto';
import { GetPetMembershipQueryDto } from './dto/get-pet-membership-query.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('pet-memberships')
@UseGuards(AuthGuard)
export class PetMembershipController {
  constructor(private readonly petMembershipService: PetMembershipService) {}

  @Post()
  async create(@Body() createPetMembershipDto: CreatePetMembershipDto) {
    const petMembership = await this.petMembershipService.create(
      createPetMembershipDto,
    );
    return {
      message: 'pet membership purchased successfully',
      data: petMembership,
    };
  }

  @Get()
  async findAll(@Query() query: GetPetMembershipQueryDto) {
    const petMemberships = await this.petMembershipService.findAll(query);
    return {
      message: 'pet memberships retrieved successfully',
      data: petMemberships,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const petMembership = await this.petMembershipService.findById(id);
    return {
      message: 'pet membership retrieved successfully',
      data: petMembership,
    };
  }

  @Get(':pet_id/active')
  async getActiveMembership(@Param('pet_id') petId: string) {
    const petMembership =
      await this.petMembershipService.getActiveMembership(petId);
    return {
      message: petMembership
        ? 'active membership found'
        : 'no active membership',
      data: petMembership,
    };
  }

  @Get(':pet_id/benefits-summary')
  async getBenefitsSummary(@Param('pet_id') petId: string) {
    const summary = await this.petMembershipService.getBenefitsSummary(petId);
    return {
      message: 'benefits summary retrieved successfully',
      data: summary,
    };
  }

  @Get(':pet_id/benefits-history')
  async getBenefitsHistory(
    @Param('pet_id') petId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const history = await this.petMembershipService.getBenefitsHistory(petId, {
      limit: limit ? parseInt(limit) : 100,
      skip: skip ? parseInt(skip) : 0,
    });
    return {
      message: 'benefits history retrieved successfully',
      data: history,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePetMembershipDto: UpdatePetMembershipDto,
  ) {
    const petMembership = await this.petMembershipService.update(
      id,
      updatePetMembershipDto,
    );
    return {
      message: 'pet membership updated successfully',
      data: petMembership,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const petMembership = await this.petMembershipService.delete(id);
    return {
      message: 'pet membership cancelled successfully',
      data: petMembership,
    };
  }
}
