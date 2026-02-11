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
  Query,
} from '@nestjs/common';
import { OptionService } from './option.service';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { ObjectId } from 'mongodb';

@Controller('options')
export class OptionController {
  constructor(private readonly optionService: OptionService) {}

  @Post()
  async create(@Body() body: CreateOptionDto) {
    await this.optionService.create(body);

    return {
      message: 'Create option successfully',
    };
  }

  @Get()
  async findAll(@Query('category') category: string) {
    const options = await this.optionService.findAll(category);
    return {
      message: 'Fetch options successfully',
      options,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const option = await this.optionService.findOne(_id);
    if (!option || option.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch option successfully',
      option,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateOptionDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const option = await this.optionService.findOne(_id);
    if (!option || option.isDeleted)
      throw new NotFoundException('data not found');

    await this.optionService.update(_id, body);

    return {
      message: 'Update option successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const option = await this.optionService.findOne(_id);
    if (!option || option.isDeleted)
      throw new NotFoundException('data not found');

    await this.optionService.remove(_id);

    return {
      message: 'Delete option successfully',
    };
  }
}
