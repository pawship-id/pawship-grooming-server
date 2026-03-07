import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { GetBannersQueryDto } from './dto/get-banners-query.dto';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';

@Controller('banners')
@UseGuards(AuthGuard)
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  async create(@Body() body: CreateBannerDto) {
    await this.bannerService.create(body);
    return {
      message: 'Create banner successfully',
    };
  }

  @Get()
  async findAll(@Query() query: GetBannersQueryDto) {
    const result = await this.bannerService.findAll(query);
    return {
      message: 'Fetch banners successfully',
      ...result,
    };
  }

  // Public endpoint — untuk ditampilkan ke user/guest tanpa login
  @Public()
  @Get('active')
  async findActive() {
    const result = await this.bannerService.findAll({
      is_active: true,
      page: 1,
      limit: 100,
    });
    return {
      message: 'Fetch active banners successfully',
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const banner = await this.bannerService.findOne(_id);
    if (!banner || banner.isDeleted)
      throw new NotFoundException('data not found');

    return {
      message: 'Fetch banner successfully',
      banner,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateBannerDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const banner = await this.bannerService.findOne(_id);
    if (!banner || banner.isDeleted)
      throw new NotFoundException('data not found');

    await this.bannerService.update(_id, body);
    return {
      message: 'Update banner successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const banner = await this.bannerService.findOne(_id);
    if (!banner || banner.isDeleted)
      throw new NotFoundException('data not found');

    await this.bannerService.remove(_id);
    return {
      message: 'Delete banner successfully',
    };
  }
}
