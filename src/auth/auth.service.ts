import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { comparePassword, hashPassword } from 'src/helpers/bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from 'src/user/user.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from 'src/user/user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async createUser(body: CreateUserDto) {
    try {
      const hash = await hashPassword(body.password);

      const user = new this.userModel({
        username: body.username,
        email: body.email,
        phone_number: body.phone_number,
        password: hash,
        role: body.role,
        is_active: body.is_active,
      });

      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
    }
  }

  async findUserByEmail(email: string) {
    const user = await this.userModel.findOne({ email: email });

    return user;
  }

  async signIn(email: string, password: string): Promise<string> {
    const findUser = await this.findUserByEmail(email);
    if (!findUser) throw new UnauthorizedException('invalid email or password');

    const isMatch = await comparePassword(password, findUser.password);
    if (!isMatch) throw new UnauthorizedException('invalid email or password');

    const payload = {
      _id: findUser._id,
      email: findUser.email,
      username: findUser.username,
      role: findUser.role,
    };

    const token = await this.jwtService.signAsync(payload);

    return token;
  }
}
