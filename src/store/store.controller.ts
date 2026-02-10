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
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { ObjectId } from 'mongodb';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  async create(@Body() createStoreDto: CreateStoreDto) {
    await this.storeService.create(createStoreDto);

    return {
      message: 'Create store successfully',
    };
  }

  @Get()
  async findAll() {
    const stores = await this.storeService.findAll();

    return {
      message: 'Fetch stores successfully',
      stores,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const store = await this.storeService.findOne(_id);
    if (!store || store.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch store successfully',
      store,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const store = await this.storeService.findOne(_id);
    if (!store || store.isDeleted)
      throw new NotFoundException('data not found');

    await this.storeService.update(_id, updateStoreDto);

    return {
      message: 'Update store successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const store = await this.storeService.findOne(_id);
    if (!store || store.isDeleted)
      throw new NotFoundException('data not found');

    await this.storeService.remove(_id);

    return {
      message: 'Delete store successfully',
    };
  }
}
