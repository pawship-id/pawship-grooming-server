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
import { PetService } from 'src/pet/pet.service';
import { ObjectId } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  GetUsersQueryDto,
  ToggleUserStatusDto,
  UpdatePasswordDto,
} from './dto/get-users-query.dto';
import { UpdatePetDto } from 'src/pet/dto/update-pet.dto';
import { GetPetsQueryDto } from 'src/pet/dto/get-pets-query.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateMyPetDto } from './dto/create-my-pet.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly petService: PetService,
  ) {}

  // ── Admin — list all ───────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Query() query: GetUsersQueryDto) {
    const result = await this.userService.getUsers(query);
    return { message: 'Fetch users successfully', ...result };
  }

  // ── /me routes (declared before /:id to avoid route collision) ──────────────

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Req() request: any) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const user = await this.userService.findById(new ObjectId(userId));
    if (!user || user.isDeleted) throw new NotFoundException('User not found');
    return { message: 'Fetch current user successfully', user };
  }

  @Put('me/profile')
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(@Req() request: any, @Body() body: UpdateProfileDto) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const user = await this.userService.updateProfile(
      new ObjectId(userId),
      body,
    );
    return { message: 'Update profile successfully', user };
  }

  // ── /me/pets CRUD ───────────────────────────────────────────────────────

  @Post('me/pets')
  @HttpCode(HttpStatus.CREATED)
  async createMyPet(@Req() request: any, @Body() body: CreateMyPetDto) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const pet = await this.petService.create({ ...body, customer_id: userId });
    return { message: 'Create pet successfully', pet };
  }

  @Get('me/pets')
  @HttpCode(HttpStatus.OK)
  async getMyPets(@Req() request: any, @Query() query: GetPetsQueryDto) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const result = await this.petService.findAll({
      ...query,
      customer_id: userId,
    });
    return { message: 'Fetch pets successfully', ...result };
  }

  @Get('me/pets/:petId')
  @HttpCode(HttpStatus.OK)
  async getMyPetById(@Req() request: any, @Param('petId') petId: string) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const pet = await this.petService.findOne(new ObjectId(petId));
    if (!pet || pet.isDeleted) throw new NotFoundException('Pet not found');
    if (pet.customer_id.toString() !== userId.toString())
      throw new NotFoundException('Pet not found');
    return { message: 'Fetch pet successfully', pet };
  }

  @Put('me/pets/:petId')
  @HttpCode(HttpStatus.OK)
  async updateMyPet(
    @Req() request: any,
    @Param('petId') petId: string,
    @Body() body: UpdatePetDto,
  ) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const pet = await this.petService.findOne(new ObjectId(petId));
    if (!pet || pet.isDeleted) throw new NotFoundException('Pet not found');
    if (pet.customer_id.toString() !== userId.toString())
      throw new NotFoundException('Pet not found');
    await this.petService.update(new ObjectId(petId), body);
    return { message: 'Update pet successfully' };
  }

  @Delete('me/pets/:petId')
  @HttpCode(HttpStatus.OK)
  async deleteMyPet(@Req() request: any, @Param('petId') petId: string) {
    const userId = request.user?._id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const pet = await this.petService.findOne(new ObjectId(petId));
    if (!pet || pet.isDeleted) throw new NotFoundException('Pet not found');
    if (pet.customer_id.toString() !== userId.toString())
      throw new NotFoundException('Pet not found');
    await this.petService.remove(new ObjectId(petId));
    return { message: 'Delete pet successfully' };
  }

  // ── Admin — user CRUD ───────────────────────────────────────────────────

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');
    const user = await this.userService.findById(new ObjectId(id));
    if (!user || user.isDeleted) throw new NotFoundException('data not found');
    return { message: 'Fetch user successfully', user };
  }

  @Put(':id/profile')
  @HttpCode(HttpStatus.OK)
  async updateUserProfile(
    @Param('id') id: string,
    @Body() body: UpdateProfileDto,
  ) {
    if (!id) throw new BadRequestException('id is required');
    const user = await this.userService.findById(new ObjectId(id));
    if (!user || user.isDeleted) throw new NotFoundException('data not found');
    await this.userService.updateProfile(new ObjectId(id), body);
    return { message: 'Update user profile successfully' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() body: CreateUserDto) {
    const user = await this.userService.create(body);
    return { message: 'Create user successfully', user };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    if (!id) throw new BadRequestException('id is required');
    const user = await this.userService.findById(new ObjectId(id));
    if (!user || user.isDeleted) throw new NotFoundException('data not found');
    await this.userService.update(new ObjectId(id), body);
    return { message: 'Update user successfully' };
  }

  @Patch('update-password/:id')
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Param('id') id: string,
    @Body() body: UpdatePasswordDto,
  ) {
    if (!id) throw new BadRequestException('id is required');
    const user = await this.userService.findById(new ObjectId(id));
    if (!user || user.isDeleted) throw new NotFoundException('data not found');
    await this.userService.updatePassword(new ObjectId(id), body.password);
    return { message: 'Update password successfully' };
  }

  @Patch('toggle-status/:id')
  @HttpCode(HttpStatus.OK)
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() body: ToggleUserStatusDto,
  ) {
    if (!id) throw new BadRequestException('id is required');
    const user = await this.userService.findById(new ObjectId(id));
    if (!user || user.isDeleted) throw new NotFoundException('data not found');
    await this.userService.toggleStatus(new ObjectId(id), body.is_active);
    const status = body.is_active ? 'activated' : 'deactivated';
    return { message: `User ${status} successfully` };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id is required');
    const findUser = await this.userService.findById(new ObjectId(id));
    if (!findUser || findUser.isDeleted)
      throw new NotFoundException('data not found');
    await this.userService.delete(new ObjectId(id));
    return { message: 'Delete user successfully' };
  }
}
