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
  UseGuards,
  Query,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';
import { ZoneService } from './zone.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { GetZonesQueryDto } from './dto/get-zones-query.dto';

@Controller('zones')
@UseGuards(AuthGuard)
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  async create(@Body() body: CreateZoneDto) {
    const zone = await this.zoneService.create(body);

    return {
      message: 'Create zone successfully',
      zone,
    };
  }

  @Get()
  async findAll(@Query() query: GetZonesQueryDto) {
    const result = await this.zoneService.findAll(query);

    return {
      message: 'Fetch zones successfully',
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const zone = await this.zoneService.findOne(_id);
    if (!zone || zone.isDeleted) throw new NotFoundException('data not found');

    return {
      message: 'Fetch zone successfully',
      zone,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateZoneDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const zone = await this.zoneService.findOne(_id);
    if (!zone || zone.isDeleted) throw new NotFoundException('data not found');

    const updated = await this.zoneService.update(_id, body);

    return {
      message: 'Update zone successfully',
      zone: updated,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const zone = await this.zoneService.findOne(_id);
    if (!zone || zone.isDeleted) throw new NotFoundException('data not found');

    await this.zoneService.remove(_id);

    return {
      message: 'Delete zone successfully',
    };
  }
}
