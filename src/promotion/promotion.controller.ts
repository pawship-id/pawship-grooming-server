import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { GetPromotionsQueryDto } from './dto/get-promotions-query.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionService } from './promotion.service';

@Controller('promotions')
@UseGuards(AuthGuard)
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  async create(@Body() body: CreatePromotionDto) {
    await this.promotionService.create(body);
    return { message: 'Create promotion successfully' };
  }

  @Get()
  async findAll(@Query() query: GetPromotionsQueryDto) {
    const result = await this.promotionService.findAll(query);
    return { message: 'Fetch promotions successfully', ...result };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');
    const _id = new ObjectId(id);
    const promotion = await this.promotionService.findOne(_id);
    if (!promotion) throw new NotFoundException('data not found');
    return { message: 'Fetch promotion successfully', promotion };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePromotionDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const promotion = await this.promotionService.findById(_id);
    if (!promotion || promotion.isDeleted)
      throw new NotFoundException('data not found');

    await this.promotionService.update(_id, body);

    return { message: 'Update promotion successfully' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');
    const _id = new ObjectId(id);
    const promotion = await this.promotionService.findById(_id);
    if (!promotion || promotion.isDeleted)
      throw new NotFoundException('data not found');
    await this.promotionService.remove(_id);
    return { message: 'Delete promotion successfully' };
  }
}
