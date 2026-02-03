import { InjectModel } from '@mongoloquent/nestjs';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from './user.model';
import { comparePassword, hashPassword } from 'src/helpers/bcrypt';
import { JwtService } from '@nestjs/jwt';

interface IUserCreate {
  username: string;
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async createUser(newUser: IUserCreate) {
    const hash = await hashPassword(newUser.password);

    const findUser = await this.findUserByEmail(newUser.email);
    if (findUser) throw new BadRequestException('email already exist');

    const user = this.userModel.create({
      username: newUser.username,
      email: newUser.email,
      password: hash,
    });

    return user;
  }

  async findUserByEmail(email: string) {
    const user = await this.userModel.where('email', email).first();

    return user;
  }

  async signIn(email: string, password: string): Promise<string> {
    const findUser = await this.findUserByEmail(email);
    if (!findUser) throw new UnauthorizedException('invalid email or password');

    const isMatch = await comparePassword(password, findUser.password);
    if (!isMatch) throw new UnauthorizedException('invalid email or password');

    const payload = { _id: findUser._id, email: findUser.email };

    const token = await this.jwtService.signAsync(payload);

    return token;
  }
}
