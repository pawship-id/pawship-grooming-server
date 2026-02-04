import { InjectModel } from '@mongoloquent/nestjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { RoleUser, User } from './user.model';
import { ObjectId } from 'mongodb';
import { hashPassword } from 'src/helpers/bcrypt';

interface IUserCreate {
  username: string;
  email: string;
  password: string;
  role: RoleUser;
  is_active: boolean;
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  async getUsers() {
    const users = await this.userModel.get();
    return users;
  }

  async findById(id: ObjectId) {
    const user = await this.userModel.where('_id', id).first();
    return user;
  }

  async create(body: IUserCreate) {
    const hash = await hashPassword(body.password);

    const findUser = await this.findByEmail(body.email);
    if (findUser) throw new BadRequestException('email already exist');

    const user = this.userModel.create({
      username: body.username,
      email: body.email,
      password: hash,
      role: body.role,
      is_active: body.is_active,
    });

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.userModel.where('email', email).first();

    return user;
  }

  async update(id: ObjectId, body: IUserCreate) {
    const user = await this.userModel.where('_id', id).update(body);
    return user;
  }

  async delete(id: ObjectId) {
    const user = await this.userModel.where('_id', id).delete();
    return user;
  }
}
