import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Patch,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ObjectId } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  GetUsersQueryDto,
  ToggleUserStatusDto,
  UpdatePasswordDto,
} from './dto/get-users-query.dto';
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
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Req() request: any) {
    const userId = request.user?._id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const _id = new ObjectId(userId);
    const user = await this.userService.findById(_id);

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Fetch current user successfully',
      user,
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

  @Patch('update-password/:id')
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Param('id') id: string,
    @Body() body: UpdatePasswordDto,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user || user.isDeleted) throw new NotFoundException('data not found');

    await this.userService.updatePassword(_id, body.password);

    return {
      message: 'Update password successfully',
    };
  }

  @Patch('toggle-status/:id')
  @HttpCode(HttpStatus.OK)
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() body: ToggleUserStatusDto,
  ) {
    if (!id) throw new BadRequestException('id is required');

    const _id = new ObjectId(id);
    const user = await this.userService.findById(_id);
    if (!user || user.isDeleted) throw new NotFoundException('data not found');

    await this.userService.toggleStatus(_id, body.is_active);

    const status = body.is_active ? 'activated' : 'deactivated';

    return {
      message: `User ${status} successfully`,
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
