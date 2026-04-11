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
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceTypeService } from './service-type.service';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { GetServiceTypesQueryDto } from './dto/get-service-types-query.dto';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';

@Controller('service-types')
@UseGuards(AuthGuard)
export class ServiceTypeController {
  constructor(private readonly serviceTypeService: ServiceTypeService) {}

  @Post()
  async create(@Body() body: CreateServiceTypeDto) {
    await this.serviceTypeService.create(body);

    return {
      message: 'Create service type successfully',
    };
  }

  @Get()
  async findAll(@Query() query: GetServiceTypesQueryDto) {
    const result = await this.serviceTypeService.findAll(query);

    return {
      message: 'Fetch service types successfully',
      ...result,
    };
  }

  @Public()
  @Get('public/homepage')
  async findAllForHomepage() {
    const serviceTypes = await this.serviceTypeService.findAllForHomepage();
    return {
      message: 'Fetch homepage service types successfully',
      serviceTypes,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const serviceType = await this.serviceTypeService.findOne(_id);
    if (!serviceType || serviceType.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch service type successfully',
      serviceType,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateServiceTypeDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const serviceType = await this.serviceTypeService.findOne(_id);
    if (!serviceType || serviceType.isDeleted)
      throw new NotFoundException('data not found');

    await this.serviceTypeService.update(_id, body);

    return {
      message: 'Update service type successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const serviceType = await this.serviceTypeService.findOne(_id);
    if (!serviceType || serviceType.isDeleted)
      throw new NotFoundException('data not found');

    await this.serviceTypeService.remove(_id);

    return {
      message: 'Delete service type successfully',
    };
  }
}
