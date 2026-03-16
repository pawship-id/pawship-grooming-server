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
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { GetServicesQueryDto } from './dto/get-services-query.dto';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('services')
@UseGuards(AuthGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  async create(@Body() body: CreateServiceDto) {
    await this.serviceService.create(body);

    return {
      message: 'Create service successfully',
    };
  }

  @Get()
  async findAll(@Query() query: GetServicesQueryDto) {
    const result = await this.serviceService.findAll(query);

    return {
      message: 'Fetch services successfully',
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const service = await this.serviceService.findOne(_id);
    if (!service || service.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch service successfully',
      service,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateServiceDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const service = await this.serviceService.findOne(_id);
    if (!service || service.isDeleted)
      throw new NotFoundException('data not found');

    await this.serviceService.update(_id, body);

    return {
      message: 'Update service successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const service = await this.serviceService.findOne(_id);
    if (!service || service.isDeleted)
      throw new NotFoundException('data not found');

    await this.serviceService.remove(_id);

    return {
      message: 'Delete service successfully',
    };
  }
}
