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
} from '@nestjs/common';
import { PetService } from './pet.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('pets')
@UseGuards(AuthGuard)
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Post()
  async create(@Body() body: CreatePetDto) {
    await this.petService.create(body);

    return {
      message: 'Create pet successfully',
    };
  }

  @Get()
  async findAll() {
    const pets = await this.petService.findAll();

    return {
      message: 'Fetch pets successfully',
      pets,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const pet = await this.petService.findOne(_id);
    if (!pet || pet.isDeleted) throw new NotFoundException('data not found');

    return {
      message: 'Fetch pet successfully',
      pet,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePetDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const pet = await this.petService.findOne(_id);
    if (!pet || pet.isDeleted) throw new NotFoundException('data not found');

    await this.petService.update(_id, body);

    return {
      message: 'Update pet successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const pet = await this.petService.findOne(_id);
    if (!pet || pet.isDeleted) throw new NotFoundException('data not found');

    await this.petService.remove(_id);

    return {
      message: 'Delete pet successfully',
    };
  }
}
