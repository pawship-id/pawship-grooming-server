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
} from '@nestjs/common';
import { UserService } from './user.service';
import { ObjectId } from 'mongodb';
import { RoleUser } from './user.model';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUser() {
    const users = await this.userService.getUsers();

    return {
      message: 'Fetch users successfully',
      users,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user) throw new NotFoundException('data not found');

    return {
      message: 'Fetch user successfully',
      user,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body('username') username: string,
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('role') role: string,
    @Body('is_active') is_active: boolean,
  ) {
    if (!username) throw new BadRequestException('username is required');
    if (!email) throw new BadRequestException('email is required');
    if (!password) throw new BadRequestException('password is required');
    if (!role) throw new BadRequestException('role is required');
    if (!is_active) throw new BadRequestException('status is required');

    await this.userService.create({
      username,
      email,
      password,
      role: role as RoleUser,
      is_active: is_active,
    });

    return {
      message: 'Create user successfully',
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body('username') username: string,
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('role') role: string,
    @Body('is_active') is_active: boolean,
  ) {
    if (!id) throw new BadRequestException('id is required');
    if (!username) throw new BadRequestException('username is required');
    if (!email) throw new BadRequestException('email is required');
    if (!password) throw new BadRequestException('password is required');
    if (!role) throw new BadRequestException('role is required');
    if (!is_active) throw new BadRequestException('status is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user) throw new NotFoundException('data not found');

    const body = {
      username,
      email,
      password,
      role: role as RoleUser,
      is_active,
    };
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
    const user = await this.userService.delete(_id);
    if (user === 0) throw new NotFoundException('data not found');

    return {
      message: 'Delete user successfully',
    };
  }
}
