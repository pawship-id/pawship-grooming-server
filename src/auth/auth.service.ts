import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { comparePassword, hashPassword } from 'src/helpers/bcrypt';
import { capitalizeWords } from 'src/helpers/string.helper';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';
import { EmailService } from 'src/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async createUser(body: CreateUserDto) {
    try {
      // Self-registration requires password
      if (!body.password) {
        throw new BadRequestException('password is required for registration');
      }
      const hash = await hashPassword(body.password);

      // Normalize email: convert empty string to undefined to work with sparse index
      const normalizedEmail =
        body.email && body.email.trim() !== '' ? body.email : undefined;

      const user = new this.userModel({
        username: capitalizeWords(body.username),
        email: normalizedEmail,
        phone_number: body.phone_number,
        password: hash,
        role: body.role,
        is_active: body.is_active,
        // Self-registration: user is actively logging in, so not idle
        is_idle: body.role === 'customer' ? false : undefined,
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

  async signIn(email: string, password: string) {
    const findUser = await this.findUserByEmail(email);
    if (!findUser) throw new UnauthorizedException('invalid email or password');

    if (findUser.isDeleted) {
      throw new UnauthorizedException('user not found');
    }

    if (findUser.is_active === false) {
      throw new UnauthorizedException('user is inactive');
    }

    // Users without password (idle customers created by admin) cannot login
    if (!findUser.password) {
      throw new UnauthorizedException('invalid email or password');
    }

    const isMatch = await comparePassword(password, findUser.password);
    if (!isMatch) throw new UnauthorizedException('invalid email or password');

    const payload = {
      _id: findUser._id.toString(),
      email: findUser.email,
      username: findUser.username,
      role: findUser.role,
    };

    const tokens = await this.generateTokens(payload);
    await this.updateRefreshToken(findUser._id, tokens.refresh_token);

    // Mark idle customer as no longer idle on first login
    if (findUser.role === 'customer' && findUser.is_idle !== false) {
      await this.userModel.updateOne(
        { _id: findUser._id },
        { $set: { is_idle: false } },
      );
    }

    return tokens;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });

      const user = await this.userModel.findById(payload._id).exec();
      if (!user || user.isDeleted) {
        throw new UnauthorizedException('user not found');
      }

      if (user.is_active === false) {
        throw new UnauthorizedException('user is inactive');
      }

      if (!user.refresh_token) {
        throw new UnauthorizedException('refresh token is invalid');
      }

      if (user.refresh_token_expires_at) {
        const isExpired = new Date() > user.refresh_token_expires_at;
        if (isExpired) {
          throw new UnauthorizedException('refresh token is expired');
        }
      }

      const isMatch = await comparePassword(refreshToken, user.refresh_token);
      if (!isMatch) {
        throw new UnauthorizedException('refresh token is invalid');
      }

      const newPayload = {
        _id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      };

      const tokens = await this.generateTokens(newPayload);
      await this.updateRefreshToken(user._id, tokens.refresh_token);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('refresh token is invalid');
    }
  }

  async revokeRefreshToken(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { refresh_token: null, refresh_token_expires_at: null },
    });
  }

  private async generateTokens(payload: {
    _id: string;
    email?: string;
    username: string;
    role: string;
  }) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getAccessTokenSecret(),
      expiresIn: this.parseExpiresInToSeconds(this.getAccessTokenExpiresIn()),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.parseExpiresInToSeconds(this.getRefreshTokenExpiresIn()),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async updateRefreshToken(
    userId: ObjectId | string,
    refreshToken: string,
  ) {
    const refreshTokenHash = await hashPassword(refreshToken);
    const expiresAt = this.getExpiryDate(this.getRefreshTokenExpiresIn());

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        refresh_token: refreshTokenHash,
        refresh_token_expires_at: expiresAt,
      },
    });
  }

  private getAccessTokenSecret() {
    return this.configService.get<string>('JWT_SECRET_KEY');
  }

  private getRefreshTokenSecret() {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET_KEY') ||
      this.configService.get<string>('JWT_SECRET_KEY')
    );
  }

  private getAccessTokenExpiresIn() {
    return this.configService.get<string>('JWT_EXPIRES_IN') || '3600s';
  }

  private getRefreshTokenExpiresIn() {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  private getExpiryDate(expiresIn: string | number) {
    const ms = this.parseExpiresInToMs(expiresIn);
    return ms ? new Date(Date.now() + ms) : null;
  }

  private parseExpiresInToSeconds(expiresIn: string | number) {
    const ms = this.parseExpiresInToMs(expiresIn);
    return ms ? Math.floor(ms / 1000) : 0;
  }

  private parseExpiresInToMs(expiresIn: string | number) {
    if (typeof expiresIn === 'number') {
      return expiresIn * 1000;
    }

    const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      return 0;
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  async checkPhone(phone_number: string) {
    const user = await this.userModel
      .findOne({ phone_number })
      .select('username email password')
      .exec();

    if (!user) {
      return {
        exists: false,
        hasEmail: false,
        hasPassword: false,
      };
    }

    return {
      exists: true,
      hasEmail: !!user.email,
      hasPassword: !!user.password,
      username: user.username,
      email: user.email || undefined,
    };
  }

  async sendPasswordSetup(phone_number: string, email: string) {
    const user = await this.userModel
      .findOne({ phone_number })
      .select('username email password')
      .exec();

    if (!user) {
      throw new BadRequestException('Phone number not found');
    }

    if (user.password) {
      throw new BadRequestException(
        'User already has a password. Please use forgot password.',
      );
    }

    // Update email if it's different
    if (user.email !== email) {
      // Check if email is already used by another user
      const emailExists = await this.userModel
        .findOne({ email, _id: { $ne: user._id } })
        .exec();
      if (emailExists) {
        throw new BadRequestException('Email already used by another account');
      }
      user.email = email;
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await hashPassword(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.password_setup_token = hashedToken;
    user.password_setup_token_expires_at = expiresAt;
    await user.save();

    // Send email
    await this.emailService.sendPasswordSetupEmail({
      email,
      username: user.username,
      token,
    });

    return { message: 'Password setup email sent successfully' };
  }

  async verifySetupToken(token: string) {
    const users = await this.userModel
      .find({
        password_setup_token: { $exists: true, $ne: null },
        password_setup_token_expires_at: { $gt: new Date() },
      })
      .select('username email phone_number password_setup_token')
      .exec();

    for (const user of users) {
      const isMatch = await comparePassword(
        token,
        user.password_setup_token || '',
      );
      if (isMatch) {
        return {
          valid: true,
          user: {
            username: user.username,
            phone_number: user.phone_number,
            email: user.email,
          },
        };
      }
    }

    throw new BadRequestException('Invalid or expired token');
  }

  async setPassword(token: string, password: string) {
    const users = await this.userModel
      .find({
        password_setup_token: { $exists: true, $ne: null },
        password_setup_token_expires_at: { $gt: new Date() },
      })
      .exec();

    for (const user of users) {
      const isMatch = await comparePassword(
        token,
        user.password_setup_token || '',
      );
      if (isMatch) {
        const hashedPassword = await hashPassword(password);
        user.password = hashedPassword;
        user.password_setup_token = undefined;
        user.password_setup_token_expires_at = undefined;
        user.is_idle = false; // Mark as active since they set up their account
        await user.save();

        return { message: 'Password set successfully' };
      }
    }

    throw new BadRequestException('Invalid or expired token');
  }
}
