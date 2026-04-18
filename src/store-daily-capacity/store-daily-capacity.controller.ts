import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { StoreDailyCapacityService } from './store-daily-capacity.service';
import { CreateStoreDailyCapacityDto } from './dto/create-store-daily-capacity.dto';
import { UpdateStoreDailyCapacityDto } from './dto/update-store-daily-capacity.dto';
import { GetStoreDailyCapacitiesDto } from './dto/get-store-daily-capacities.dto';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';

@Controller('store-daily-capacities')
@UseGuards(AuthGuard)
export class StoreDailyCapacityController {
  constructor(
    private readonly storeDailyCapacityService: StoreDailyCapacityService,
  ) {}

  @Public()
  @Get('public')
  async findPublicClosedDates(
    @Query('store_id') storeId: string,
  ) {
    if (!storeId) throw new BadRequestException('store_id is required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const capacities = await this.storeDailyCapacityService.findAll({
      store_id: storeId,
    });

    // Return only dates from today onwards with total_capacity_minutes = 0
    const closedDates = capacities
      .filter((c) => {
        const d = new Date(c.date);
        d.setHours(0, 0, 0, 0);
        return d >= today && c.total_capacity_minutes === 0;
      })
      .map((c) => {
        const d = new Date(c.date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      });

    return {
      message: 'Fetch public closed dates successfully',
      closed_dates: closedDates,
    };
  }

  @Post()
  async create(@Body() body: CreateStoreDailyCapacityDto, @Req() request: any) {
    // Auto-assign created_by from authenticated user
    if (request.user?._id) {
      body.created_by = request.user._id.toString();
    }

    await this.storeDailyCapacityService.create(body);

    return {
      message: 'Create store daily capacity successfully',
    };
  }

  @Get()
  async findAll(@Query() query: GetStoreDailyCapacitiesDto) {
    const capacities = await this.storeDailyCapacityService.findAll(query);

    return {
      message: 'Fetch store daily capacities successfully',
      capacities,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const capacity = await this.storeDailyCapacityService.findOne(_id);

    return {
      message: 'Fetch store daily capacity successfully',
      capacity,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStoreDailyCapacityDto,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    await this.storeDailyCapacityService.update(_id, body);

    return {
      message: 'Update store daily capacity successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    await this.storeDailyCapacityService.remove(_id);

    return {
      message: 'Delete store daily capacity successfully',
    };
  }
}
