import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BenefitUsageService } from './benefit-usage.service';
import { CreateBenefitUsageDto } from './dto/create-benefit-usage.dto';
import { GetBenefitUsageQueryDto } from './dto/get-benefit-usage-query.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('benefit-usage')
@UseGuards(AuthGuard)
export class BenefitUsageController {
  constructor(private readonly benefitUsageService: BenefitUsageService) {}

  @Post()
  async create(@Body() createBenefitUsageDto: CreateBenefitUsageDto) {
    const benefitUsage = await this.benefitUsageService.recordUsage(
      createBenefitUsageDto,
    );
    return {
      message: 'benefit usage recorded successfully',
      data: benefitUsage,
    };
  }

  @Get()
  async findAll(@Query() query: GetBenefitUsageQueryDto) {
    const benefitUsages = await this.benefitUsageService.findAll(query);
    return {
      message: 'benefit usage records retrieved successfully',
      data: benefitUsages,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const benefitUsage = await this.benefitUsageService.findById(id);
    return {
      message: 'benefit usage record retrieved successfully',
      data: benefitUsage,
    };
  }

  @Get(':pet_membership_id/history')
  async getUsageHistory(
    @Param('pet_membership_id') petMembershipId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const history = await this.benefitUsageService.getUsageHistory(
      petMembershipId,
      {
        limit: limit ? parseInt(limit) : 100,
        skip: skip ? parseInt(skip) : 0,
      },
    );
    return {
      message: 'usage history retrieved successfully',
      data: history,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const benefitUsage = await this.benefitUsageService.delete(id);
    return {
      message: 'benefit usage record deleted successfully',
      data: benefitUsage,
    };
  }
}
