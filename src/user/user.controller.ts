import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Get,
  Param,
  Post,
  Put,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ObjectId } from 'mongodb';
import {
  CreateUserDto,
  UpdateUserDto,
  UserRole,
  GetUsersQueryDto,
} from './user.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Query() query: GetUsersQueryDto) {
    const result = await this.userService.getUsers(query);

    return {
      message: 'Fetch users successfully',
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user || user.isDeleted) throw new NotFoundException('data not found');

    return {
      message: 'Fetch user successfully',
      user,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() body: CreateUserDto) {
    await this.userService.create(body);

    return {
      message: 'Create user successfully',
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user || user.isDeleted) throw new NotFoundException('data not found');

    await this.userService.update(_id, body);

    return {
      message: 'Update user successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const findUser = await this.userService.findById(_id);
    if (!findUser || findUser.isDeleted)
      throw new NotFoundException('data not found');

    await this.userService.delete(_id);

    return {
      message: 'Delete user successfully',
    };
  }
}
